-- CreateEnum
CREATE TYPE "CommunityPlatform" AS ENUM ('FACEBOOK');

-- CreateEnum
CREATE TYPE "CommunityPublicationStatus" AS ENUM ('PUBLISHED', 'NEEDS_REVIEW', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "CommunitySourceStatus" AS ENUM ('RECRUITING', 'FULL', 'CANCELLED', 'DELETED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CommunitySkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'OPEN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CommunityFeeBasis" AS ENUM ('PER_PERSON', 'PER_HOUR', 'TOTAL', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CommunityReportType" AS ENUM ('WRONG_INFO', 'FULL', 'CANCELLED', 'REMOVAL_REQUEST');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "integration_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_sources" (
    "id" TEXT NOT NULL,
    "platform" "CommunityPlatform" NOT NULL DEFAULT 'FACEBOOK',
    "external_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ingest_enabled" BOOLEAN NOT NULL DEFAULT true,
    "public_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_areas" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "community_areas_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "community_listings" (
    "id" TEXT NOT NULL,
    "platform" "CommunityPlatform" NOT NULL DEFAULT 'FACEBOOK',
    "source_id" TEXT NOT NULL,
    "source_post_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "time_zone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "venue_name" TEXT,
    "venue_address" TEXT,
    "area_code" TEXT,
    "skill_level" "CommunitySkillLevel" NOT NULL DEFAULT 'UNKNOWN',
    "skill_text" TEXT,
    "fee_vnd" INTEGER,
    "fee_basis" "CommunityFeeBasis" NOT NULL DEFAULT 'UNKNOWN',
    "fee_text" TEXT,
    "requested_players" INTEGER,
    "organizer_name" TEXT,
    "contacts" JSONB NOT NULL DEFAULT '[]',
    "schedule_kind" TEXT NOT NULL DEFAULT 'SINGLE',
    "raw_text" TEXT,
    "evidence" JSONB,
    "raw_retained_until" TIMESTAMP(3),
    "source_posted_at" TIMESTAMP(3),
    "source_updated_at" TIMESTAMP(3),
    "observed_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_verified_at" TIMESTAMP(3) NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "publication_status" "CommunityPublicationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "source_status" "CommunitySourceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "review_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suppression_reason" TEXT,
    "duplicate_candidate_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snapshot_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "anonymized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_ingest_operations" (
    "id" TEXT NOT NULL,
    "integration_client_id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "listing_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_ingest_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_listing_reports" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "type" "CommunityReportType" NOT NULL,
    "note" TEXT,
    "reporter_contact" TEXT,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_listing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_audit_logs" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_credentials_key_id_key" ON "integration_credentials"("key_id");

-- CreateIndex
CREATE INDEX "integration_credentials_client_id_idx" ON "integration_credentials"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_sources_platform_external_group_id_key" ON "community_sources"("platform", "external_group_id");

-- CreateIndex
CREATE INDEX "community_listings_publication_status_starts_at_id_idx" ON "community_listings"("publication_status", "starts_at", "id");

-- CreateIndex
CREATE INDEX "community_listings_source_id_last_verified_at_id_idx" ON "community_listings"("source_id", "last_verified_at", "id");

-- CreateIndex
CREATE INDEX "community_listings_raw_retained_until_idx" ON "community_listings"("raw_retained_until");

-- CreateIndex
CREATE UNIQUE INDEX "community_listings_platform_source_post_id_key" ON "community_listings"("platform", "source_post_id");

-- CreateIndex
CREATE INDEX "community_ingest_operations_created_at_idx" ON "community_ingest_operations"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "community_ingest_operations_integration_client_id_operation_key" ON "community_ingest_operations"("integration_client_id", "operation_id");

-- CreateIndex
CREATE INDEX "community_listing_reports_status_created_at_idx" ON "community_listing_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "community_audit_logs_target_type_target_id_created_at_idx" ON "community_audit_logs"("target_type", "target_id", "created_at");

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "integration_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_listings" ADD CONSTRAINT "community_listings_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "community_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_listings" ADD CONSTRAINT "community_listings_area_code_fkey" FOREIGN KEY ("area_code") REFERENCES "community_areas"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_ingest_operations" ADD CONSTRAINT "community_ingest_operations_integration_client_id_fkey" FOREIGN KEY ("integration_client_id") REFERENCES "integration_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_ingest_operations" ADD CONSTRAINT "community_ingest_operations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "community_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_listing_reports" ADD CONSTRAINT "community_listing_reports_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "community_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
