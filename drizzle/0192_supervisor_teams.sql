CREATE TABLE IF NOT EXISTS "supervisor_teams" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "supervisor_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL,
  "name" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "image_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "supervisor_teams_branch_tenant_fk" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE CASCADE,
  CONSTRAINT "supervisor_teams_name_length_check" CHECK (char_length(trim("name")) BETWEEN 2 AND 60),
  CONSTRAINT "supervisor_teams_description_length_check" CHECK (char_length("description") <= 280),
  CONSTRAINT "supervisor_teams_image_data_url_check" CHECK (
    "image_url" IS NULL OR (
      "image_url" ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
      AND octet_length("image_url") <= 204800
    )
  ),
  CONSTRAINT "supervisor_teams_supervisor_unique" UNIQUE ("tenant_id", "supervisor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supervisor_team_invites" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "branch_id" text NOT NULL,
  "supervisor_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "message" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "decided_at" timestamptz,
  CONSTRAINT "supervisor_team_invites_branch_tenant_fk" FOREIGN KEY ("branch_id", "tenant_id") REFERENCES "branches"("id", "tenant_id") ON DELETE CASCADE,
  CONSTRAINT "supervisor_team_invites_status_check" CHECK ("status" IN ('pending', 'accepted', 'declined', 'cancelled')),
  CONSTRAINT "supervisor_team_invites_message_length_check" CHECK ("message" IS NULL OR char_length("message") <= 280)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "supervisor_team_invites_one_pending_idx"
  ON "supervisor_team_invites" ("tenant_id", "supervisor_id", "broker_id")
  WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supervisor_team_invites_broker_pending_idx"
  ON "supervisor_team_invites" ("tenant_id", "broker_id", "status", "created_at" DESC);
