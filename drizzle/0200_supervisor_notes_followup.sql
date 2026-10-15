-- G3 Gestao de Equipes: novos tipos de feedback (ponto de melhoria, acompanhamento) e data "Revisar em".
ALTER TABLE "supervisor_notes" DROP CONSTRAINT IF EXISTS "supervisor_notes_kind_check";

ALTER TABLE "supervisor_notes"
  ADD CONSTRAINT "supervisor_notes_kind_check"
  CHECK ("kind" IN ('orientacao', 'elogio', 'alerta', 'melhoria', 'acompanhamento'));

ALTER TABLE "supervisor_notes"
  ADD COLUMN IF NOT EXISTS "follow_up_at" timestamptz NULL;
