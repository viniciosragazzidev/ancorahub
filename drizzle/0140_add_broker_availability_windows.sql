CREATE TABLE IF NOT EXISTS "broker_availability_windows" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "day_of_week" integer NOT NULL,
  "starts_at" text NOT NULL,
  "ends_at" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "broker_availability_windows_day_range" CHECK ("day_of_week" BETWEEN 0 AND 6),
  CONSTRAINT "broker_availability_windows_time_order" CHECK ("starts_at" < "ends_at")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "broker_availability_windows_lookup_idx"
  ON "broker_availability_windows" ("tenant_id", "broker_id", "day_of_week", "starts_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_availability_windows_unique_interval"
  ON "broker_availability_windows" ("tenant_id", "broker_id", "day_of_week", "starts_at", "ends_at");
