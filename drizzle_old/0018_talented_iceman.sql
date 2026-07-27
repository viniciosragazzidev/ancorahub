CREATE TABLE "whatsapp_connections" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"session_id" text,
	"session_name" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"qr_code" text,
	"webhook_secret" text,
	"chat_interno_ativo" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"lead_id" text,
	"client_id" text,
	"message_id" text,
	"phone" text NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "whatsapp_messages_tenant_lead_idx" ON "whatsapp_messages" USING btree ("tenant_id","lead_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_messages_message_unique" ON "whatsapp_messages" USING btree ("tenant_id","message_id");