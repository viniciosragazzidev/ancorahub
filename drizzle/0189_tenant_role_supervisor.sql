-- 0189: the "supervisor" role existed in the code (tenantRoleValues) but never in
-- the database enum (0024/0036 created tenant_role with director, manager, broker).
-- Saving a member as Supervisor failed with: invalid input value for enum tenant_role.
ALTER TYPE "public"."tenant_role" ADD VALUE IF NOT EXISTS 'supervisor' BEFORE 'broker';
