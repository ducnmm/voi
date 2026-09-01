-- Feed and group lists filter SCHEDULED sessions by ends_at.
CREATE INDEX "sessions_status_ends_at_idx" ON "sessions"("status", "ends_at");

-- Notification inbox is keyed by user + recency.
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
