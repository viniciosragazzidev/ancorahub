-- Each person can turn off the "Novo lead recebido" pop-up (toast + sound).
-- The notification itself stays in the bell and in /notificacoes.
ALTER TABLE tenant_memberships ADD COLUMN IF NOT EXISTS lead_toast_enabled boolean NOT NULL DEFAULT true;
