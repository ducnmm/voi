import { env } from "../../config/env.js";

export interface PushPayload {
  title: string;
  body: string;
  sessionId?: string | null;
}

export interface PushSender {
  send(deviceTokens: string[], payload: PushPayload): Promise<void>;
}

/** Test/dev sender that records what it would have pushed. */
export class MockPushSender implements PushSender {
  public readonly sent: Array<{ tokens: string[]; payload: PushPayload }> = [];
  private failuresLeft = 0;

  failNext(times: number): void {
    this.failuresLeft = times;
  }

  async send(deviceTokens: string[], payload: PushPayload): Promise<void> {
    if (this.failuresLeft > 0) {
      this.failuresLeft -= 1;
      throw new Error("mock push failure");
    }
    this.sent.push({ tokens: deviceTokens, payload });
  }
}

/** Placeholder until a real APNs key (.p8) is provided; see Spec 0013. */
export class UnconfiguredApnsSender implements PushSender {
  async send(): Promise<void> {
    throw new Error("APNs is not configured (missing .p8 key)");
  }
}

export function isPushConfigured(): boolean {
  return Boolean(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_KEY_PATH);
}
