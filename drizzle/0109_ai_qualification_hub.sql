ALTER TABLE "ai_qualification_configs" ADD COLUMN IF NOT EXISTS "pause_mode" text DEFAULT 'handoff_active' NOT NULL;

CREATE TABLE IF NOT EXISTS "ai_qualification_test_numbers" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
	"phone_number" text NOT NULL,
	"label" text NOT NULL,
	"owner_user_id" text REFERENCES "user"("id") ON DELETE set null,
	"active" boolean DEFAULT true NOT NULL,
	"auto_reset_mode" text DEFAULT 'before_each_session' NOT NULL,
	"isolated_from_metrics" boolean DEFAULT true NOT NULL,
	"isolated_from_queues" boolean DEFAULT true NOT NULL,
	"allow_test_commands" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_qualification_test_numbers_tenant_phone_unique" UNIQUE("tenant_id","phone_number")
);
