import type { FastifyInstance } from "fastify";
import { runDeliveryTick } from "../services/notification-delivery.js";
import {
  isPushConfigured,
  UnconfiguredApnsSender,
  type PushSender
} from "../services/push/sender.js";

const TICK_MS = 30_000;

/**
 * Starts the background delivery loop. Stays idle until APNs is configured, so
 * the dev server does not churn notifications into the dead-letter state.
 */
export function startNotificationWorker(
  app: FastifyInstance,
  sender: PushSender = new UnconfiguredApnsSender()
): NodeJS.Timeout | null {
  if (!isPushConfigured()) {
    app.log.info("Push not configured (no APNs key); notification worker idle");
    return null;
  }

  const timer = setInterval(() => {
    void runDeliveryTick({ now: new Date(), sender }).catch((error) => {
      app.log.error({ error }, "notification delivery tick failed");
    });
  }, TICK_MS);
  timer.unref();
  return timer;
}
