-- Add updatedAt column to leads table
ALTER TABLE "leads" ADD COLUMN "updated_at" timestamp with time zone NOT NULL DEFAULT now();

-- Add service_started to lead_interaction_type enum
ALTER TYPE "lead_interaction_type" ADD VALUE IF NOT EXISTS 'service_started' BEFORE 'whatsapp_msg';
