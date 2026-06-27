-- AlterTable
ALTER TABLE "session_participants" ADD COLUMN     "checked_in_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "match_results" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score_a" INTEGER NOT NULL,
    "score_b" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_results_session_id_idx" ON "match_results"("session_id");

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
