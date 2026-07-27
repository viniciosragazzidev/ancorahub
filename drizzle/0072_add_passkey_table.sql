CREATE TABLE IF NOT EXISTS "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text,
	"updated_at" timestamp,
	CONSTRAINT "passkey_credential_id_unique" UNIQUE("credential_id")
);

CREATE INDEX IF NOT EXISTS "passkey_user_id_idx" ON "passkey" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credential_id_unique" ON "passkey" USING btree ("credential_id");
