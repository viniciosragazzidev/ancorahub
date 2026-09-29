-- schema.ts's brokerLifecycleStatusValues has named 8 states since commit
-- c8c00e7e (2026-07-26), but the actual "lifecycle_status" Postgres enum was
-- never migrated past the original 4 from 0066_add_broker_onboarding_tables:
-- DRAFT, INVITED, ACTIVE, DISABLED. Every read that filters broker_profiles
-- by one of the newer states (conversas/page.tsx, broker-template-actions.ts)
-- fails with "invalid input value for enum lifecycle_status". No row
-- currently uses DISABLED or DRAFT, so this only adds values — nothing to
-- migrate on existing data.
ALTER TYPE "lifecycle_status" ADD VALUE IF NOT EXISTS 'INVITATION_EXPIRED';
--> statement-breakpoint
ALTER TYPE "lifecycle_status" ADD VALUE IF NOT EXISTS 'ONBOARDING';
--> statement-breakpoint
ALTER TYPE "lifecycle_status" ADD VALUE IF NOT EXISTS 'SUSPENDED';
--> statement-breakpoint
ALTER TYPE "lifecycle_status" ADD VALUE IF NOT EXISTS 'INACTIVE';
--> statement-breakpoint
ALTER TYPE "lifecycle_status" ADD VALUE IF NOT EXISTS 'ARCHIVED';
