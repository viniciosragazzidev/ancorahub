CREATE TABLE IF NOT EXISTS "supervisor_notes" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "supervisor_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "broker_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('orientacao', 'elogio', 'alerta')),
  "body" text NOT NULL CHECK (char_length("body") BETWEEN 1 AND 1000),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "supervisor_notes_tenant_broker_created_idx"
  ON "supervisor_notes" ("tenant_id", "broker_id", "created_at" DESC);
