CREATE TYPE "lifecycle_status" AS ENUM('DRAFT', 'INVITED', 'ACTIVE', 'DISABLED');
--> statement-breakpoint
CREATE TYPE "onboarding_status" AS ENUM('PENDING', 'COMPLETED');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broker_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"user_id" text,
	"internal_code" text NOT NULL,
	"professional_name" text NOT NULL,
	"phone" text NOT NULL,
	"invited_email" text NOT NULL,
	"cpf" text NOT NULL,
	"lifecycle_status" "lifecycle_status" NOT NULL DEFAULT 'DRAFT',
	"manager_id" text NOT NULL,
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "broker_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" text NOT NULL,
	"broker_profile_id" text NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_onboarding" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"status" "onboarding_status" NOT NULL DEFAULT 'PENDING',
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "terms_acceptances" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"terms_version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_profiles_tenant_internal_code_unique" ON "broker_profiles" ("tenant_id", "internal_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_profiles_tenant_invited_email_unique" ON "broker_profiles" ("tenant_id", "invited_email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_profiles_tenant_cpf_unique" ON "broker_profiles" ("tenant_id", "cpf");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "broker_invitations_token_hash_unique" ON "broker_invitations" ("token_hash");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_onboarding_user_tenant_unique" ON "user_onboarding" ("user_id", "tenant_id");
