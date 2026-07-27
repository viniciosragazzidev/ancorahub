-- Promotional Materials (Materiais de Divulgação)
-- Migration: 0050_promotional_materials.sql

CREATE TYPE "promotional_material_category" AS ENUM (
  'todos', 'avisos', 'eventos', 'informativos',
  'premiacoes', 'promocoes', 'treinamentos', 'materiais_divulgacao'
);

CREATE TABLE "promotional_materials" (
  "id" text PRIMARY KEY,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "category" "promotional_material_category" NOT NULL DEFAULT 'materiais_divulgacao',
  "image_url" text,
  "file_url" text,
  "target_branch" text,
  "target_carrier" text,
  "target_state" text,
  "active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "promo_materials_tenant_idx" ON "promotional_materials" ("tenant_id");
CREATE INDEX "promo_materials_category_idx" ON "promotional_materials" ("category");
CREATE INDEX "promo_materials_active_idx" ON "promotional_materials" ("active");
