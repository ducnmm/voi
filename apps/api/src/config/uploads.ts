import path from "node:path";

/** Where uploaded images are written (served statically at `/uploads/`). */
export const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/** Accepted image mime types → file extension. */
export const ALLOWED_IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic"
};
