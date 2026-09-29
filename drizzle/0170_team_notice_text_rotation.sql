-- Text rotation for team notices sent by the company number (anti-ban).
-- Several library messages per notice; the single column stays as the first.
ALTER TABLE team_notice_settings
  ADD COLUMN IF NOT EXISTS free_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
UPDATE team_notice_settings SET free_message_ids = jsonb_build_array(free_message_id)
  WHERE free_message_id IS NOT NULL AND free_message_ids = '[]'::jsonb;
--> statement-breakpoint
-- Which version a notice used, so the same person does not get it twice in a row.
ALTER TABLE whatsapp_outbound_messages
  ADD COLUMN IF NOT EXISTS text_variant text;
