-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "default_venue_id" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "venue_id" TEXT;

-- AlterTable
ALTER TABLE "community_listings" ADD COLUMN     "skill_normalization_input_hash" TEXT,
ADD COLUMN     "skill_normalization_manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skill_normalization_notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skill_normalization_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "skill_normalization_status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
ADD COLUMN     "skill_normalization_version" TEXT,
ADD COLUMN     "skill_normalized_at" TIMESTAMP(3),
ADD COLUMN     "skill_recruitment_audience" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "venue_candidate_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "venue_id" TEXT,
ADD COLUMN     "venue_maps_url" TEXT,
ADD COLUMN     "venue_resolution_input_hash" TEXT,
ADD COLUMN     "venue_resolution_manual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "venue_resolution_status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
ADD COLUMN     "venue_resolved_at" TIMESTAMP(3),
ADD COLUMN     "venue_resolver_version" TEXT;

-- CreateTable
CREATE TABLE "skill_scales" (
    "code" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "skill_scales_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "skill_ranks" (
    "code" TEXT NOT NULL,
    "scale_code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "skill_ranks_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "skill_aliases" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "rank_code" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL,

    CONSTRAINT "skill_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_skill_requirements" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "min_rank" TEXT,
    "max_rank" TEXT,
    "min_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "max_inclusive" BOOLEAN NOT NULL DEFAULT true,
    "alternative" INTEGER NOT NULL DEFAULT 0,
    "evidence" TEXT NOT NULL,

    CONSTRAINT "community_skill_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "area_code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location_source" TEXT,
    "location_verified_at" TIMESTAMP(3),
    "location_expires_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_aliases" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "normalized_address" TEXT NOT NULL DEFAULT '',
    "area_code" TEXT NOT NULL DEFAULT '',
    "source_id" TEXT NOT NULL DEFAULT '',
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_external_refs" (
    "id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "place_id" TEXT NOT NULL,
    "url" TEXT,
    "fetched_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "venue_external_refs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "skill_ranks_scale_code_order_key" ON "skill_ranks"("scale_code", "order");

-- CreateIndex
CREATE UNIQUE INDEX "skill_aliases_token_scope_key" ON "skill_aliases"("token", "scope");

-- CreateIndex
CREATE INDEX "community_skill_requirements_audience_min_rank_max_rank_idx" ON "community_skill_requirements"("audience", "min_rank", "max_rank");

-- CreateIndex
CREATE UNIQUE INDEX "community_skill_requirements_listing_id_audience_alternativ_key" ON "community_skill_requirements"("listing_id", "audience", "alternative");

-- CreateIndex
CREATE INDEX "venues_area_code_name_idx" ON "venues"("area_code", "name");

-- CreateIndex
CREATE INDEX "venue_aliases_normalized_name_area_code_idx" ON "venue_aliases"("normalized_name", "area_code");

-- CreateIndex
CREATE UNIQUE INDEX "venue_aliases_venue_id_normalized_name_normalized_address_a_key" ON "venue_aliases"("venue_id", "normalized_name", "normalized_address", "area_code", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "venue_external_refs_provider_place_id_key" ON "venue_external_refs"("provider", "place_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_default_venue_id_fkey" FOREIGN KEY ("default_venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_listings" ADD CONSTRAINT "community_listings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_ranks" ADD CONSTRAINT "skill_ranks_scale_code_fkey" FOREIGN KEY ("scale_code") REFERENCES "skill_scales"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_skill_requirements" ADD CONSTRAINT "community_skill_requirements_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "community_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_skill_requirements" ADD CONSTRAINT "community_skill_requirements_min_rank_fkey" FOREIGN KEY ("min_rank") REFERENCES "skill_ranks"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_skill_requirements" ADD CONSTRAINT "community_skill_requirements_max_rank_fkey" FOREIGN KEY ("max_rank") REFERENCES "skill_ranks"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_aliases" ADD CONSTRAINT "venue_aliases_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_external_refs" ADD CONSTRAINT "venue_external_refs_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "community_skill_requirements" ADD CONSTRAINT "skill_requirement_mode_check" CHECK ("audience" IN ('ALL','MALE','FEMALE') AND "mode" IN ('RANGE','UNRESTRICTED','UNKNOWN') AND (("mode"='RANGE' AND ("min_rank" IS NOT NULL OR "max_rank" IS NOT NULL)) OR ("mode"<>'RANGE' AND "min_rank" IS NULL AND "max_rank" IS NULL)));
ALTER TABLE "venues" ADD CONSTRAINT "venue_coordinates_check" CHECK (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL AND "latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180));
INSERT INTO "skill_scales" ("code","version","label") VALUES ('VN_COMMUNITY_V1','vn-community-v1.0','Trình độ cộng đồng Voi');
INSERT INTO "skill_ranks" ("code","scale_code","label","order") VALUES
('NEWBIE','VN_COMMUNITY_V1','Newbie',10),('YEU','VN_COMMUNITY_V1','Yếu',20),('YEU_PLUS','VN_COMMUNITY_V1','Yếu+',30),('TBY','VN_COMMUNITY_V1','TBY',40),('TBY_PLUS','VN_COMMUNITY_V1','TBY+',45),('TB_MINUS','VN_COMMUNITY_V1','TB-',50),('TB','VN_COMMUNITY_V1','TB',60),('TB_PLUS','VN_COMMUNITY_V1','TB+',70);
