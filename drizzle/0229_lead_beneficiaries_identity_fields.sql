-- Registrar venda v2: permitir que o titular seja criado com os dados disponíveis no lead.
-- Esta migration deve ser executada pelo responsável pelo banco, nunca durante a tarefa do agente.
ALTER TABLE lead_beneficiaries
  ALTER COLUMN birth_date DROP NOT NULL;

ALTER TABLE lead_beneficiaries
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS cpf text;
