-- Session cover photos (nullable-safe add; already in Prisma schema).
ALTER TABLE "sessions"
ADD COLUMN IF NOT EXISTS "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
