UPDATE "account"
SET
  "issuer" = 'local:credential',
  "account_id" = "user_id",
  "updated_at" = now()
WHERE
  "provider_id" = 'credential'
  AND (
    "issuer" IS DISTINCT FROM 'local:credential'
    OR "account_id" IS DISTINCT FROM "user_id"
  );
