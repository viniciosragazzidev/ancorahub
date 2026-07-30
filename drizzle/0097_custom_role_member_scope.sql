-- Marketing defaults to a tenant-wide administrative role. A Director can
-- create a separate Marketing role with `branch` scope when work is local.
UPDATE "custom_roles"
SET "scope" = 'tenant'
WHERE lower("name") = 'marketing'
  AND "scope" = 'none';
