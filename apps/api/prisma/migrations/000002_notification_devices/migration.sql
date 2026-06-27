CREATE TYPE "PushPlatform" AS ENUM ('IOS');

CREATE TABLE "push_devices" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "platform" "PushPlatform" NOT NULL DEFAULT 'IOS',
  "device_token" TEXT NOT NULL,
  "app_version" TEXT,
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
  "status_changes_enabled" BOOLEAN NOT NULL DEFAULT true,
  "waitlist_enabled" BOOLEAN NOT NULL DEFAULT true,
  "reminder_lead_minutes" INTEGER NOT NULL DEFAULT 120,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_devices_device_token_key" ON "push_devices"("device_token");
CREATE INDEX "push_devices_user_id_idx" ON "push_devices"("user_id");
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
