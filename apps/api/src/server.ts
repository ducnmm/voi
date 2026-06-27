import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { buildApp } from "./app.js";
import { startNotificationWorker } from "./workers/notification-worker.js";

const app = await buildApp();

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", () => {
  shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  shutdown().finally(() => process.exit(0));
});

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT
});

startNotificationWorker(app);
