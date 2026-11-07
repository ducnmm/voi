import type { z } from "zod";
import type { CreateGroupSchema, CreateSessionSchema } from "@voi/shared";
import type {
  AuthResponse,
  GroupDetail,
  GroupSummary,
  InviteDetail,
  SessionDetail,
  UserProfile,
} from "./api-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

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
  signal?: AbortSignal;
  retried?: boolean;
  token?: string | null;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = { accept: "application/json" };

  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const accessToken =
    token && typeof window !== "undefined"
      ? (window.localStorage.getItem("voi.token") ?? token)
      : token;
  if (accessToken) headers["authorization"] = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: options.signal,
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Không thể kết nối. Vui lòng thử lại.",
    );
  }

  if (
    response.status === 401 &&
    !options.retried &&
    token &&
    !path.startsWith("/auth/")
  ) {
    const latest =
      typeof window !== "undefined"
        ? window.localStorage.getItem("voi.token")
        : null;
    const renewed =
      latest && latest !== accessToken ? latest : await refreshAccessToken();
    if (renewed)
      return request<T>(path, { ...options, token: renewed, retried: true });
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("voi:expired"));
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(
      response.status,
      "invalid_response",
      "Máy chủ trả về dữ liệu không hợp lệ.",
    );
  }

  if (!response.ok) {
    const errorPayload = payload as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      response.status,
      errorPayload?.error?.code ?? "request_failed",
      errorPayload?.error?.message ?? `Request failed (${response.status})`,
    );
  }

  return payload as T;
}

export const api = {
  devLogin(email: string, displayName?: string): Promise<AuthResponse> {
    return request<AuthResponse>("/auth/dev", {
      method: "POST",
      body: { email, displayName },
    });
  },

  me(token: string): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>("/me", { token });
  },

  listGroups(token: string): Promise<{ groups: GroupSummary[] }> {
    return request<{ groups: GroupSummary[] }>("/groups", { token });
  },

  createGroup(
    token: string,
    input: CreateGroupInput,
  ): Promise<{ group: GroupSummary }> {
    return request<{ group: GroupSummary }>("/groups", {
      method: "POST",
      body: input,
      token,
    });
  },

  getGroup(token: string, groupId: string): Promise<{ group: GroupDetail }> {
    return request<{ group: GroupDetail }>(`/groups/${groupId}`, { token });
  },

  createSession(
    token: string,
    groupId: string,
    input: CreateSessionInput,
  ): Promise<{ session: SessionDetail; inviteUrl: string }> {
    return request<{ session: SessionDetail; inviteUrl: string }>(
      `/groups/${groupId}/sessions`,
      { method: "POST", body: input, token },
    );
  },

  getSession(
    sessionId: string,
    token?: string | null,
  ): Promise<{ session: SessionDetail }> {
    return request<{ session: SessionDetail }>(`/sessions/${sessionId}`, {
      token,
    });
  },

  cancelSession(
    token: string,
    sessionId: string,
  ): Promise<{ session: SessionDetail }> {
    return request<{ session: SessionDetail }>(
      `/sessions/${sessionId}/cancel`,
      {
        method: "POST",
        token,
      },
    );
  },

  rsvp(
    token: string,
    sessionId: string,
    status: RsvpChoice,
  ): Promise<{ session: SessionDetail; promotedParticipantId: string | null }> {
    return request<{
      session: SessionDetail;
      promotedParticipantId: string | null;
    }>(`/sessions/${sessionId}/rsvp`, {
      method: "POST",
      body: { status },
      token,
    });
  },

  setPayment(
    token: string,
    sessionId: string,
    participantId: string,
    paymentStatus: PaymentChoice,
  ): Promise<{ session: SessionDetail }> {
    return request<{ session: SessionDetail }>(
      `/sessions/${sessionId}/participants/${participantId}/payment`,
      { method: "PATCH", body: { paymentStatus }, token },
    );
  },

  getInvite(invToken: string): Promise<{ invite: InviteDetail }> {
    return request<{ invite: InviteDetail }>(`/invites/${invToken}`);
  },
};

export { API_BASE_URL };

let refreshPromise: Promise<string | null> | null = null;
export function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem("voi.refresh");
  if (!refreshToken) return Promise.resolve(null);
  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const pair = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
      };
      localStorage.setItem("voi.token", pair.accessToken);
      localStorage.setItem("voi.refresh", pair.refreshToken);
      return pair.accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
export async function uploadImage(token: string, file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const send = () =>
    fetch(`${API_BASE_URL}/uploads`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${localStorage.getItem("voi.token") ?? token}`,
      },
      body,
    });
  let response: Response;
  try {
    response = await send();
    if (response.status === 401) {
      if (await refreshAccessToken()) response = await send();
      else if (typeof window !== "undefined")
        window.dispatchEvent(new Event("voi:expired"));
    }
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Không thể tải ảnh lên. Vui lòng thử lại.",
    );
  }
  let data: { url?: string; error?: { message?: string } };
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      "invalid_response",
      "Không thể tải ảnh lên. Vui lòng thử lại.",
    );
  }
  if (!response.ok || !data.url)
    throw new ApiError(
      response.status,
      "upload_failed",
      data.error?.message ?? "Không thể tải ảnh lên.",
    );
  return data.url;
}
