-- WhatsApp Business app coexistence: the same number stays in the app and is
-- also on the Cloud API. Such a channel is never registered by the CRM (the
-- app already did it) and must request the one-time contacts/history sync
-- within 24h of onboarding. Existing channels keep the standard mode.
ALTER TABLE communication_channels ADD COLUMN IF NOT EXISTS onboarding_mode text NOT NULL DEFAULT 'cloud_api';
ALTER TABLE communication_channels ADD COLUMN IF NOT EXISTS sync_status text;
ALTER TABLE communication_channels ADD COLUMN IF NOT EXISTS sync_requested_at timestamptz;
ALTER TABLE communication_channels ADD COLUMN IF NOT EXISTS sync_error text;
