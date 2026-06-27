CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'OPEN');
CREATE TYPE "GroupRole" AS ENUM ('HOST', 'MEMBER');
CREATE TYPE "SessionVisibility" AS ENUM ('PRIVATE_LINK', 'GROUP_ONLY');
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "RsvpStatus" AS ENUM ('JOINED', 'MAYBE', 'DECLINED', 'WAITLISTED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'UNPAID', 'PAID');
CREATE TYPE "NotificationType" AS ENUM ('SESSION_REMINDER', 'WAITLIST_PROMOTION', 'SESSION_CANCELLED', 'SESSION_CHANGED');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "default_skill_level" "SkillLevel" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "default_venue_name" TEXT,
  "default_skill_level" "SkillLevel" NOT NULL DEFAULT 'OPEN',
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "group_members" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "host_user_id" TEXT NOT NULL,
  "title" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "venue_name" TEXT NOT NULL,
  "venue_note" TEXT,
  "court_count" INTEGER NOT NULL,
  "max_players" INTEGER NOT NULL,
  "fee_total_vnd" INTEGER,
  "shuttlecock_cost_vnd" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "skill_level" "SkillLevel" NOT NULL DEFAULT 'OPEN',
  "visibility" "SessionVisibility" NOT NULL DEFAULT 'PRIVATE_LINK',
  "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session_participants" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "rsvp_status" "RsvpStatus" NOT NULL,
  "joined_at" TIMESTAMP(3),
  "waitlist_position" INTEGER,
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "notes" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courts" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lineup_slots" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "court_id" TEXT NOT NULL,
  "participant_id" TEXT NOT NULL,
  "slot_order" INTEGER NOT NULL,
  CONSTRAINT "lineup_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invites" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "group_id" TEXT,
  "session_id" TEXT,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT,
  "type" "NotificationType" NOT NULL,
  "delivery_status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "scheduled_for" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");
CREATE INDEX "sessions_group_id_starts_at_idx" ON "sessions"("group_id", "starts_at");
CREATE INDEX "sessions_host_user_id_idx" ON "sessions"("host_user_id");
CREATE UNIQUE INDEX "session_participants_session_id_user_id_key" ON "session_participants"("session_id", "user_id");
CREATE INDEX "session_participants_session_id_rsvp_status_idx" ON "session_participants"("session_id", "rsvp_status");
CREATE INDEX "session_participants_session_id_waitlist_position_idx" ON "session_participants"("session_id", "waitlist_position");
CREATE UNIQUE INDEX "courts_session_id_sort_order_key" ON "courts"("session_id", "sort_order");
CREATE UNIQUE INDEX "lineup_slots_participant_id_key" ON "lineup_slots"("participant_id");
CREATE UNIQUE INDEX "lineup_slots_court_id_slot_order_key" ON "lineup_slots"("court_id", "slot_order");
CREATE INDEX "lineup_slots_session_id_idx" ON "lineup_slots"("session_id");
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");
CREATE INDEX "invites_group_id_idx" ON "invites"("group_id");
CREATE INDEX "invites_session_id_idx" ON "invites"("session_id");
CREATE INDEX "notifications_user_id_delivery_status_idx" ON "notifications"("user_id", "delivery_status");
CREATE INDEX "notifications_session_id_idx" ON "notifications"("session_id");

ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "courts" ADD CONSTRAINT "courts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lineup_slots" ADD CONSTRAINT "lineup_slots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lineup_slots" ADD CONSTRAINT "lineup_slots_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lineup_slots" ADD CONSTRAINT "lineup_slots_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "session_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
