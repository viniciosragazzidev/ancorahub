-- Additional form data for PF/PME-specific fields (dependents, ages, etc.)
ALTER TABLE "leads" ADD COLUMN "form_data" jsonb NOT NULL DEFAULT '{}'::jsonb;
