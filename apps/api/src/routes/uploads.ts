import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { badRequest } from "../utils/api-error.js";
import { ALLOWED_IMAGE_EXT, MAX_UPLOAD_BYTES, UPLOADS_DIR } from "../config/uploads.js";

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // Upload a single image; returns an absolute URL served from `/uploads/`.
  app.post(
    "/uploads",
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
    },
    async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
    if (!file) {
      throw badRequest("No file uploaded");
    }

    const ext = ALLOWED_IMAGE_EXT[file.mimetype];
    if (!ext) {
      throw badRequest("Unsupported image type (jpeg, png, webp, heic only)");
    }

    await mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    const dest = path.join(UPLOADS_DIR, filename);

    await pipeline(file.file, createWriteStream(dest));

    // The multipart parser flags this once the stream exceeds the byte limit.
    if (file.file.truncated) {
      await unlink(dest).catch(() => undefined);
      throw badRequest("Image is too large (max 8MB)");
    }

    const base = `${request.protocol}://${request.host}`;
    return reply.code(201).send({ url: `${base}/uploads/${filename}` });
  });
}
