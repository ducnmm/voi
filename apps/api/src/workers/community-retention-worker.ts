import type { FastifyInstance } from "fastify";
import { runCommunityRetention } from "../services/community-retention.js";

export function startCommunityRetentionWorker(app: FastifyInstance): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runCommunityRetention();
      if (Object.values(result).some((value) => typeof value === "number" && value > 0)) {
        app.log.info(result, "Community retention completed");
      }
    } catch {
      app.log.error("Community retention failed; next hourly tick will retry");
    } finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, 60 * 60 * 1000);
  timer.unref();
  app.addHook("onClose", async () => { clearInterval(timer); });
  void tick();
}
