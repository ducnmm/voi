import type { z } from "zod";
import type {
  CreateGroupSchema,
  CreateSessionSchema
} from "@voi/shared";
import type {
  AuthResponse,
  GroupDetail,
  GroupSummary,
  InviteDetail,
  SessionDetail,
  UserProfile
} from "./api-types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:43187/v1";

export type CreateGroupInput = z.input<typeof CreateGroupSchema>;
export type CreateSessionInput = z.input<typeof CreateSessionSchema>;

export type RsvpChoice = "JOINED" | "MAYBE" | "DECLINED" | "CANCELLED";
export type PaymentChoice = "UNPAID" | "PAID";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = { accept: "application/json" };

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store"
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the Voi API.");
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const errorPayload = payload as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(
      response.status,
      errorPayload?.error?.code ?? "request_failed",
      errorPayload?.error?.message ?? `Request failed (${response.status})`
    );
  }

  return payload as T;
}

export const api = {
  devLogin(email: string, displayName?: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/dev", {
      method: "POST",
      body: { email, displayName }
    });
  },

  me(token: string): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>("/me", { token });
  },

  listGroups(token: string): Promise<{ groups: GroupSummary[] }> {
    return request<{ groups: GroupSummary[] }>("/groups", { token });
  },

  createGroup(token: string, input: CreateGroupInput): Promise<{ group: GroupSummary }> {
    return request<{ group: GroupSummary }>("/groups", {
      method: "POST",
      body: input,
      token
    });
  },

  getGroup(token: string, groupId: string): Promise<{ group: GroupDetail }> {
    return request<{ group: GroupDetail }>(`/groups/${groupId}`, { token });
  },

  createSession(
    token: string,
    groupId: string,
    input: CreateSessionInput
  ): Promise<{ session: SessionDetail; inviteUrl: string }> {
    return request<{ session: SessionDetail; inviteUrl: string }>(
      `/groups/${groupId}/sessions`,
      { method: "POST", body: input, token }
    );
  },

  getSession(sessionId: string, token?: string | null): Promise<{ session: SessionDetail }> {
    return request<{ session: SessionDetail }>(`/sessions/${sessionId}`, { token });
  },

  cancelSession(token: string, sessionId: string): Promise<{ session: SessionDetail }> {
    return request<{ session: SessionDetail }>(`/sessions/${sessionId}/cancel`, {
      method: "POST",
      token
    });
  },

  rsvp(
    token: string,
    sessionId: string,
    status: RsvpChoice
  ): Promise<{ session: SessionDetail; promotedParticipantId: string | null }> {
    return request<{ session: SessionDetail; promotedParticipantId: string | null }>(
      `/sessions/${sessionId}/rsvp`,
      { method: "POST", body: { status }, token }
    );
  },

  setPayment(
    token: string,
    sessionId: string,
    participantId: string,
    paymentStatus: PaymentChoice
  ): Promise<{ session: SessionDetail }> {
    return request<{ session: SessionDetail }>(
      `/sessions/${sessionId}/participants/${participantId}/payment`,
      { method: "PATCH", body: { paymentStatus }, token }
    );
  },

  getInvite(invToken: string): Promise<{ invite: InviteDetail }> {
    return request<{ invite: InviteDetail }>(`/invites/${invToken}`);
  }
};

export { API_BASE_URL };
