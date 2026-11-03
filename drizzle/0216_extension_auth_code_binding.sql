-- E0a: aplicar manualmente somente após aprovação do Vinicios. Códigos legados permanecem NULL.
-- deviceId é vinculado ao hash SHA-256 do código junto com extensionId; não requer coluna adicional.
ALTER TABLE extension_auth_codes ADD COLUMN IF NOT EXISTS extension_id text;
