-- Corretor vê o anúncio que trouxe o lead (10/11/2026).
-- Plano: docs/implementations/active/2026-11-10-corretor-ve-anuncio-do-lead.md
-- Aditivo. Sem as tabelas, o cartão "De onde veio" mostra só o que já está no lead.

-- O que o cliente viu: título, texto e imagem do criativo. Sem nome interno nem verba.
CREATE TABLE IF NOT EXISTS "meta_ad_creatives" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "ad_id" text NOT NULL,
  "title" text,
  "body" text,
  "media_type" text CHECK ("media_type" IS NULL OR "media_type" IN ('image', 'video', 'carousel')),
  "image_url" text,
  "source" text NOT NULL CHECK ("source" IN ('graph', 'referral')),
  "fetched_at" timestamp with time zone,
  "fetch_error" text,
  "fetch_attempts" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_creatives_tenant_ad_unique"
  ON "meta_ad_creatives" ("tenant_id", "ad_id");

-- O plano que a campanha anuncia, escrito pela gestão para o corretor.
CREATE TABLE IF NOT EXISTS "meta_campaign_broker_briefs" (
  "id" text PRIMARY KEY NOT NULL,
  "tenant_id" text NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "campaign_id" text NOT NULL,
  "offer" text NOT NULL CHECK (char_length("offer") BETWEEN 1 AND 280),
  "updated_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "meta_campaign_broker_briefs_tenant_campaign_unique"
  ON "meta_campaign_broker_briefs" ("tenant_id", "campaign_id");

-- RLS como as demais tabelas públicas: só o servidor acessa.
ALTER TABLE "meta_ad_creatives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meta_campaign_broker_briefs" ENABLE ROW LEVEL SECURITY;
