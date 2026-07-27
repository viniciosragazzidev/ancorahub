-- Fase 3: Checklists de feedback estruturados

CREATE TABLE IF NOT EXISTS "feedback_checklist_templates" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "feedback_checklist_templates_tenant_idx" ON "feedback_checklist_templates"("tenant_id");

CREATE TABLE IF NOT EXISTS "feedback_checklist_items" (
  "id" text PRIMARY KEY,
  "template_id" text NOT NULL REFERENCES "feedback_checklist_templates"("id") ON DELETE CASCADE,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "sort_order" integer NOT NULL DEFAULT 0,
  "question" text NOT NULL,
  "answer_type" text NOT NULL DEFAULT 'boolean',
  "options" jsonb,
  "required" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "feedback_checklist_items_template_idx" ON "feedback_checklist_items"("template_id", "sort_order");

ALTER TABLE "lead_feedbacks" ADD COLUMN IF NOT EXISTS "checklist_id" text REFERENCES "feedback_checklist_templates"("id");
ALTER TABLE "lead_feedbacks" ADD COLUMN IF NOT EXISTS "answers" jsonb;
