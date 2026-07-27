-- Quote snapshots can reference legacy, global, or tenant-private catalog plans.
-- The source is resolved and validated by the catalog domain before persistence.
ALTER TABLE "quote_items" DROP CONSTRAINT IF EXISTS "quote_items_plan_id_carrier_plans_id_fk";
ALTER TABLE "quote_line_items" DROP CONSTRAINT IF EXISTS "quote_line_items_plan_id_carrier_plans_id_fk";
