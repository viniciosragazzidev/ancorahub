-- E4 Lite gestao: guarda o escopo de equipe escolhido no convite e aplica no aceite.
ALTER TABLE "broker_invitations"
  ADD COLUMN "supervisor_id" text REFERENCES "user"("id") ON DELETE SET NULL;

ALTER TABLE "broker_invitations"
  ADD COLUMN "supervised_broker_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX "broker_invitations_team_scope_idx"
  ON "broker_invitations" ("tenant_id", "branch_id", "supervisor_id", "status");
