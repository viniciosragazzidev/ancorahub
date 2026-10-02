-- /conversas reads a tenant's latest messages (order by sent_at desc): it
-- scanned the table. The plantão history reads audit rows by entity: it
-- scanned 340k rows (66ms each, thousands of times a day).
CREATE INDEX IF NOT EXISTS whatsapp_messages_tenant_sent_idx ON whatsapp_messages (tenant_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entidade, entidade_id, created_at DESC);
