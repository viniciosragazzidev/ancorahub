-- Keep the direct Meta relationship between an ad creative and its Lead Ads form.
ALTER TABLE meta_ads ADD COLUMN IF NOT EXISTS lead_gen_form_id text;
