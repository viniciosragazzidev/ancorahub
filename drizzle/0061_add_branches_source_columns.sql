-- Add source tracking columns to branches table
-- These columns were part of the drizzle schema in schema.ts but were
-- not included in the 0036_reset_baseline migration for the branches table.
-- Migration 0054_unified_lead_sources.sql added them only to "leads".

ALTER TABLE "branches"
  ADD COLUMN IF NOT EXISTS "source_channel" text NOT NULL DEFAULT 'landing_page',
  ADD COLUMN IF NOT EXISTS "source_campaign" text,
  ADD COLUMN IF NOT EXISTS "source_ad" text,
  ADD COLUMN IF NOT EXISTS "source_form" text,
  ADD COLUMN IF NOT EXISTS "source_metadata" jsonb;
