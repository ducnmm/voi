UPDATE "invites"
SET "expires_at" = "created_at" + INTERVAL '7 days'
WHERE "expires_at" IS NULL;

ALTER TABLE "invites"
ALTER COLUMN "expires_at" SET NOT NULL;
