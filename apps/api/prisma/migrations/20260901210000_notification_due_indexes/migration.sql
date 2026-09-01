CREATE INDEX "notifications_delivery_status_created_at_idx"
  ON "notifications"("delivery_status", "created_at");

CREATE INDEX "groups_created_by_user_id_idx" ON "groups"("created_by_user_id");
