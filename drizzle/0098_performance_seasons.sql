CREATE TYPE "performance_season_status" AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE "performance_award_type" AS ENUM ('recognition', 'bonus', 'gift', 'other');

CREATE TABLE "performance_seasons" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "status" "performance_season_status" NOT NULL DEFAULT 'draft',
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone,
  "reset_at" timestamp with time zone,
  "reset_reason" text,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "closed_by" text REFERENCES "user"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX "performance_seasons_tenant_status_idx" ON "performance_seasons" ("tenant_id", "status");
CREATE INDEX "performance_seasons_tenant_starts_idx" ON "performance_seasons" ("tenant_id", "starts_at");

CREATE TABLE "performance_awards" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "season_id" text NOT NULL REFERENCES "performance_seasons"("id") ON DELETE CASCADE,
  "rank_position" integer NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "reward_type" "performance_award_type" NOT NULL DEFAULT 'recognition',
  "reward_value" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "performance_awards_season_rank_title_unique" ON "performance_awards" ("season_id", "rank_position", "title");
CREATE INDEX "performance_awards_tenant_season_idx" ON "performance_awards" ("tenant_id", "season_id");
