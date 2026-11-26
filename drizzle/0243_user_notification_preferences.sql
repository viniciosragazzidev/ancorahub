-- Preferências de notificação por usuário (Minha conta > Notificações, 26/11/2026).
-- Aditiva: só cria a tabela. Sem ela (ou sem linha do usuário) vale o padrão, tudo ligado e privacidade do push
-- desligada; o código confere com to_regclass antes de ler ou gravar.
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  push_privacy boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
