-- Corretor online dentro de um plantão presencial (pedido do diretor, 2026-10-20):
-- a escala pode marcar um corretor como online só naquele plantão. Ele confirma
-- presença com um toque, sem foto e sem liberação; os demais seguem presenciais.
-- NULL = segue o modo do plantão. Coluna que aceita nulo, sem valor padrão: não
-- reescreve a tabela.
ALTER TABLE "duty_roster_assignments" ADD COLUMN IF NOT EXISTS "attendance_mode" text;
--> statement-breakpoint
ALTER TABLE "duty_roster_assignments"
  DROP CONSTRAINT IF EXISTS "duty_roster_assignments_attendance_mode_check",
  ADD CONSTRAINT "duty_roster_assignments_attendance_mode_check"
  CHECK ("attendance_mode" IS NULL OR "attendance_mode" IN ('online', 'presencial'));
