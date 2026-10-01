-- WhatsApp profile pictures of contacts (read through the company WAHA
-- number), kept for a few days: WhatsApp's own link expires, and asking for
-- every picture each time would weigh on the company number.
CREATE TABLE IF NOT EXISTS contact_avatars (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_key text NOT NULL,
  image_base64 text,
  content_type text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, phone_key)
);
