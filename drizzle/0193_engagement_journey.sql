CREATE TABLE IF NOT EXISTS "engagement_missions" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('daily','weekly','team','campaign')),
  "title" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "metric" text NOT NULL,
  "target" integer NOT NULL CHECK ("target" > 0),
  "bonus_points" integer NOT NULL DEFAULT 0 CHECK ("bonus_points" >= 0),
  "period" text NOT NULL CHECK ("period" IN ('daily','weekly','campaign')),
  "audience" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','inactive')),
  "created_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "engagement_missions_id_tenant_unique" UNIQUE ("id","tenant_id"),
  CONSTRAINT "engagement_missions_dates_check" CHECK ("ends_at" IS NULL OR "starts_at" IS NULL OR "ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_missions_tenant_status_idx" ON "engagement_missions" ("tenant_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_mission_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "mission_id" text NOT NULL,
  "subject_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "subject_type" text NOT NULL DEFAULT 'broker' CHECK ("subject_type" IN ('broker','supervisor')),
  "period_key" text NOT NULL,
  "progress" integer NOT NULL DEFAULT 0 CHECK ("progress" >= 0),
  "target" integer NOT NULL CHECK ("target" > 0),
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "engagement_progress_mission_tenant_fk" FOREIGN KEY ("mission_id","tenant_id") REFERENCES "engagement_missions"("id","tenant_id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_progress_mission_subject_period_unique" ON "engagement_mission_progress" ("tenant_id","mission_id","subject_id","period_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_progress_tenant_subject_idx" ON "engagement_mission_progress" ("tenant_id","subject_id","period_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_achievements" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "badge_key" text NOT NULL,
  "earned_at" timestamptz NOT NULL DEFAULT now(),
  "evidence" jsonb NOT NULL DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_achievements_tenant_broker_badge_unique" ON "engagement_achievements" ("tenant_id","broker_id","badge_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_celebrations" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('points','mission','achievement','level','daily_summary')),
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "idempotency_key" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 10,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "seen_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "engagement_celebrations_tenant_key_unique" ON "engagement_celebrations" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_celebrations_tenant_user_seen_idx" ON "engagement_celebrations" ("tenant_id","user_id","seen_at","created_at");
--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD COLUMN IF NOT EXISTS "ranking_opt_out" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_point_events_tenant_period_broker_idx" ON "engagement_point_events" ("tenant_id","period_day","broker_id") INCLUDE ("points") WHERE "reversed_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_offers_broker_offered_at_idx" ON "lead_offers" ("broker_id","offered_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_interactions_user_note_created_idx" ON "lead_interactions" ("user_id","created_at","lead_id") WHERE "tipo" = 'note';
