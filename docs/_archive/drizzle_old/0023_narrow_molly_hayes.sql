ALTER TABLE "leads" DROP CONSTRAINT "leads_plan_id_plans_id_fk";
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_plan_id_carrier_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."carrier_plans"("id") ON DELETE no action ON UPDATE no action;