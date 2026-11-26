-- Perguntas para a direção (26/11/2026): o que a IA de qualificação não soube responder ao lead.
-- Aditiva: só cria a tabela. Sem ela, a IA segue como antes (o código confere com to_regclass antes de usar):
-- responde com a resposta lateral de sempre e nada é registrado.
CREATE TABLE IF NOT EXISTS ai_direction_questions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id text REFERENCES ai_conversations(id) ON DELETE SET NULL,
  phone text,
  transport text NOT NULL DEFAULT 'meta',
  communication_channel_id text,
  waha_run_id text,
  question text NOT NULL,
  normalized_question text NOT NULL,
  excerpt jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  answer text,
  answered_by text REFERENCES "user"(id) ON DELETE SET NULL,
  answered_at timestamp with time zone,
  sent_to_lead_at timestamp with time zone,
  taught_document_id text REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ai_direction_questions_tenant_status_idx ON ai_direction_questions (tenant_id, status, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ai_direction_questions_conversation_idx ON ai_direction_questions (conversation_id);
