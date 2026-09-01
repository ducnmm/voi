-- Group chat: a message belongs to exactly one of session or group.
ALTER TABLE "chat_messages" ALTER COLUMN "session_id" DROP NOT NULL;

ALTER TABLE "chat_messages" ADD COLUMN "group_id" TEXT;

CREATE INDEX "chat_messages_group_id_created_at_idx" ON "chat_messages"("group_id", "created_at");

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_xor_group_chk" CHECK (
  (("session_id" IS NOT NULL) AND ("group_id" IS NULL))
  OR
  (("session_id" IS NULL) AND ("group_id" IS NOT NULL))
);
