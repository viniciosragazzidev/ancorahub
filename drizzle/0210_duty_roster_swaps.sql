-- Troca de corretores entre plantões da escala publicada (pedido do Vinicios,
-- 2026-10-21): o corretor de A vai para B e o de B vai para A. As linhas de
-- duty_roster_assignments só mudam de corretor; esta tabela nova guarda a
-- troca para as duas escalações mostrarem "Troca feita" e se o WhatsApp de
-- cada corretor saiu. Tabela nova, nenhuma coluna em tabela existente.
CREATE TABLE IF NOT EXISTS "duty_roster_swaps" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "assignment_a_id" text NOT NULL REFERENCES "duty_roster_assignments"("id") ON DELETE CASCADE,
  "assignment_b_id" text NOT NULL REFERENCES "duty_roster_assignments"("id") ON DELETE CASCADE,
  "broker_a_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "broker_b_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "schedule_a_id" text NOT NULL REFERENCES "unit_duty_schedules"("id") ON DELETE CASCADE,
  "schedule_b_id" text NOT NULL REFERENCES "unit_duty_schedules"("id") ON DELETE CASCADE,
  "duty_date_a" date NOT NULL,
  "duty_date_b" date NOT NULL,
  "whatsapp_a_status" text,
  "whatsapp_b_status" text,
  "swapped_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "swapped_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "duty_roster_swaps_assignment_a_idx" ON "duty_roster_swaps" ("tenant_id", "assignment_a_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "duty_roster_swaps_assignment_b_idx" ON "duty_roster_swaps" ("tenant_id", "assignment_b_id");
