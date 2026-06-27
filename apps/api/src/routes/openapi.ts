import type { FastifyInstance } from "fastify";
import { openApiDocument } from "../openapi.js";

export async function openApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => ({
    service: "voi-api",
    version: "v1",
    openapi: "/openapi.json"
  }));

  app.get("/openapi.json", async () => openApiDocument);
}
