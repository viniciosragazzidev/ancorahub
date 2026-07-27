ALTER TABLE "ai_qualification_configs"
  ADD COLUMN IF NOT EXISTS "final_message" text NOT NULL DEFAULT 'Obrigado! Um corretor continuará seu atendimento em seguida.',
  ADD COLUMN IF NOT EXISTS "handoff_message" text NOT NULL DEFAULT 'Vou encaminhar você para um corretor da equipe agora.',
  ADD COLUMN IF NOT EXISTS "out_of_hours_message" text NOT NULL DEFAULT 'Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento.',
  ADD COLUMN IF NOT EXISTS "absence_message" text NOT NULL DEFAULT 'No momento não há um corretor disponível. Deixaremos seu atendimento na fila.',
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS "tone" text NOT NULL DEFAULT 'friendly',
  ADD COLUMN IF NOT EXISTS "use_emojis" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "form_of_address" text NOT NULL DEFAULT 'voce',
  ADD COLUMN IF NOT EXISTS "max_conversation_minutes" integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "max_questions" integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS "objectives" jsonb NOT NULL DEFAULT '["understand_need", "route_to_broker"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "business_context" text,
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
