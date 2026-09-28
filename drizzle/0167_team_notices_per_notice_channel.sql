-- Team notices: the company-number master switch is gone; each notice picks
-- "meta" (official Meta only, the new default) or "company_number" (company
-- WhatsApp with Meta as the fallback). Tenants that had the switch OFF keep
-- sending every notice through Meta only. The old switch row is left in place
-- (no longer read) so the previous deploy keeps its behavior until replaced.
UPDATE "team_notice_settings" AS s
SET "channel" = 'meta'
FROM "system_settings" AS ss
WHERE ss."key" = 'company_number_notices_enabled_' || s."tenant_id"
  AND ss."value" = 'false'
  AND s."notice_key" <> 'BROKER_CHAT';
