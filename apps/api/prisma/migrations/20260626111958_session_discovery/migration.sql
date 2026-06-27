-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "cost_tracking_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fee_per_player_vnd" INTEGER,
ADD COLUMN     "venue_lat" DOUBLE PRECISION,
ADD COLUMN     "venue_lng" DOUBLE PRECISION;
