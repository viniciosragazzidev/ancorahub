-- A director or manager can release a broker on the plantão without the
-- broker clicking the presence confirmation (e.g. an in-person plantão with
-- its own check-in). confirmed_by = who released; null = the broker clicked.
ALTER TABLE duty_presence_confirmations ADD COLUMN IF NOT EXISTS confirmed_by text REFERENCES "user"(id) ON DELETE SET NULL;
