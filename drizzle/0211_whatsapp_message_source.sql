-- Persiste a sessao WAHA que originou cada mensagem para separar conexoes
-- pessoais dos numeros corporativos na metrica de respostas recentes.
-- Linhas curtas e sem bloco DO: a versao anterior quebrou ao colar no Supabase (21/10).
alter table whatsapp_messages add column if not exists whatsapp_connection_id text;
--> statement-breakpoint
alter table whatsapp_messages add column if not exists waha_number_id text;
--> statement-breakpoint
alter table whatsapp_messages drop constraint if exists wm_connection_fk;
--> statement-breakpoint
alter table whatsapp_messages add constraint wm_connection_fk
  foreign key (whatsapp_connection_id) references whatsapp_connections(id)
  on delete set null not valid;
--> statement-breakpoint
alter table whatsapp_messages validate constraint wm_connection_fk;
--> statement-breakpoint
alter table whatsapp_messages drop constraint if exists wm_waha_number_fk;
--> statement-breakpoint
alter table whatsapp_messages add constraint wm_waha_number_fk
  foreign key (waha_number_id) references waha_numbers(id)
  on delete set null not valid;
--> statement-breakpoint
alter table whatsapp_messages validate constraint wm_waha_number_fk;
--> statement-breakpoint
create index if not exists whatsapp_messages_tenant_connection_sent_idx
  on whatsapp_messages (tenant_id, whatsapp_connection_id, sent_at desc)
  where whatsapp_connection_id is not null;
