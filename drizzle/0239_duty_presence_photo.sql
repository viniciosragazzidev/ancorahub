-- Plantão (25/11/2026): "Exigir foto na confirmação" por plantão.
-- null = padrão da modalidade (presencial confirma com foto, online com um toque);
-- true = foto obrigatória (também no online); false = sem foto (também no presencial).
-- Coluna nula e sem default: nenhum plantão existente muda de comportamento.
-- O código checa a coluna antes de usar (duty-photo-setting.ts): sem a migration, tudo segue como hoje.
ALTER TABLE "unit_duty_schedules" ADD COLUMN IF NOT EXISTS "presence_photo_required" boolean;
