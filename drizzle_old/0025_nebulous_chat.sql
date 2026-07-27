CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'urgent');--> statement-breakpoint
CREATE TABLE "lead_task_assignees" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lead_task_assignees_task_user_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "lead_tasks" ADD COLUMN "priority" "task_priority" DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_task_id_lead_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."lead_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_task_assignees" ADD CONSTRAINT "lead_task_assignees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_task_assignees_tenant_user_idx" ON "lead_task_assignees" USING btree ("tenant_id","user_id");