-- Drop FK constraint that restricts leads.plan_id to carrier_plans only.
-- Leads can now reference plans from any catalog source (carrier_plans,
-- global_plans, tenant_private_plans).
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_plan_id_carrier_plans_id_fk";
