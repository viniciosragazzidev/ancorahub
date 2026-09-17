ALTER TABLE "broker_invitations"
  ADD COLUMN IF NOT EXISTS "custom_role_id" text REFERENCES "custom_roles"("id") ON DELETE SET NULL;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "broker_invitations_custom_role_idx"
  ON "broker_invitations" ("custom_role_id");
