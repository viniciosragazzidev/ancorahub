CREATE TABLE IF NOT EXISTS "system_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
