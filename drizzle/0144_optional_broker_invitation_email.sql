ALTER TABLE "broker_profiles" ALTER COLUMN "invited_email" DROP NOT NULL;
ALTER TABLE "broker_invitations" ALTER COLUMN "email" DROP NOT NULL;
