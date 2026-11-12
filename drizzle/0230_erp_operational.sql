-- ERP operational ledger. Additive only; feature flags and tenant modules default OFF.
CREATE TABLE IF NOT EXISTS erp_module_settings (
  tenant_id text NOT NULL REFERENCES tenants(id), module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false, roles text[] NOT NULL DEFAULT ARRAY['director']::text[],
  max_import_rows integer NOT NULL DEFAULT 100 CHECK (max_import_rows BETWEEN 1 AND 500),
  version integer NOT NULL DEFAULT 1, updated_by text NOT NULL REFERENCES "user"(id), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_key)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_events (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), actor_id text NOT NULL,
  action text NOT NULL, entity_type text NOT NULL, entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_events_tenant_created_idx ON erp_events(tenant_id, created_at);
CREATE OR REPLACE FUNCTION erp_reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'ERP audit events are append-only'; END;
$$;
DROP TRIGGER IF EXISTS erp_events_append_only ON erp_events;
CREATE TRIGGER erp_events_append_only BEFORE UPDATE OR DELETE ON erp_events FOR EACH ROW EXECUTE FUNCTION erp_reject_event_mutation();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_documents (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), branch_id text REFERENCES branches(id),
  owner_id text NOT NULL REFERENCES "user"(id), sale_id text REFERENCES sales(id), object_key text NOT NULL,
  module_key text NOT NULL, state text NOT NULL DEFAULT 'uploading', lead_id text REFERENCES leads(id), financial_entry_id text,
  native_document_id text REFERENCES lead_documents(id),
  file_name text NOT NULL, content_type text NOT NULL, byte_length integer NOT NULL, sha256 text NOT NULL,
  created_by text NOT NULL REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_documents_tenant_id_unique UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS erp_documents_tenant_owner_idx ON erp_documents(tenant_id,owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS erp_documents_tenant_native_unique ON erp_documents(tenant_id,native_document_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_imports (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), domain text NOT NULL, file_name text NOT NULL,
  sha256 text NOT NULL, layout_version integer NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'preview',
  payload jsonb NOT NULL, row_count integer NOT NULL, created_by text NOT NULL REFERENCES "user"(id),
  branch_ids text[] NOT NULL DEFAULT ARRAY[]::text[], contains_unassigned boolean NOT NULL DEFAULT true,
  reviewed_by text REFERENCES "user"(id), review_reason text, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_imports_tenant_hash_domain_unique ON erp_imports(tenant_id,sha256,domain);
CREATE INDEX IF NOT EXISTS erp_imports_tenant_created_idx ON erp_imports(tenant_id,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_implantations (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), lead_id text NOT NULL REFERENCES leads(id), sale_id text REFERENCES sales(id),
  branch_id text REFERENCES branches(id), broker_id text NOT NULL REFERENCES "user"(id), status text NOT NULL DEFAULT 'review',
  reference text NOT NULL DEFAULT '', policy_number text NOT NULL DEFAULT '', coverage_starts_on date,
  evidence_document_id text REFERENCES erp_documents(id), reason text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL REFERENCES "user"(id), updated_by text NOT NULL REFERENCES "user"(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_implantations_tenant_sale_unique ON erp_implantations(tenant_id,sale_id);
CREATE UNIQUE INDEX IF NOT EXISTS erp_implantations_tenant_lead_unique ON erp_implantations(tenant_id,lead_id);
CREATE INDEX IF NOT EXISTS erp_implantations_tenant_status_idx ON erp_implantations(tenant_id,status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_financial_entries (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), kind text NOT NULL, reference text NOT NULL, request_id text NOT NULL,
  sale_id text REFERENCES sales(id), branch_id text REFERENCES branches(id), beneficiary_id text REFERENCES "user"(id), owner_id text NOT NULL REFERENCES "user"(id),
  description text NOT NULL, currency text NOT NULL DEFAULT 'BRL', amount_cents bigint NOT NULL, due_on date NOT NULL, competence text NOT NULL,
  status text NOT NULL DEFAULT 'submitted', evidence_document_id text REFERENCES erp_documents(id), origin_commission_id text REFERENCES commission_schedule(id),
  created_by text NOT NULL REFERENCES "user"(id), approved_by text REFERENCES "user"(id), approved_at timestamptz,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_financial_entries_tenant_id_unique UNIQUE(tenant_id,id),
  CONSTRAINT erp_financial_entries_positive_amount CHECK(amount_cents > 0 AND amount_cents <= 100000000000),
  CONSTRAINT erp_financial_entries_independent_approval CHECK(approved_by IS NULL OR approved_by <> created_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_financial_entries_tenant_request_unique ON erp_financial_entries(tenant_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS erp_financial_entries_tenant_reference_kind_unique ON erp_financial_entries(tenant_id,reference,kind);
CREATE UNIQUE INDEX IF NOT EXISTS erp_financial_entries_origin_commission_unique ON erp_financial_entries(tenant_id,origin_commission_id);
CREATE INDEX IF NOT EXISTS erp_financial_entries_tenant_due_idx ON erp_financial_entries(tenant_id,due_on);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_documents_entry_fk' AND conrelid = 'erp_documents'::regclass) THEN
    ALTER TABLE erp_documents ADD CONSTRAINT erp_documents_entry_fk FOREIGN KEY(tenant_id,financial_entry_id) REFERENCES erp_financial_entries(tenant_id,id);
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_settlements (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), entry_id text NOT NULL, request_id text NOT NULL,
  kind text NOT NULL DEFAULT 'payment', reverses_id text, amount_cents bigint NOT NULL, occurred_on date NOT NULL,
  evidence_document_id text NOT NULL REFERENCES erp_documents(id), reason text NOT NULL, status text NOT NULL DEFAULT 'pending',
  created_by text NOT NULL REFERENCES "user"(id), reviewed_by text REFERENCES "user"(id), reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_settlements_tenant_id_unique UNIQUE(tenant_id,id),
  CONSTRAINT erp_settlements_entry_fk FOREIGN KEY(tenant_id,entry_id) REFERENCES erp_financial_entries(tenant_id,id),
  CONSTRAINT erp_settlements_positive_amount CHECK(amount_cents > 0 AND amount_cents <= 100000000000),
  CONSTRAINT erp_settlements_independent_approval CHECK(reviewed_by IS NULL OR reviewed_by <> created_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_settlements_tenant_request_unique ON erp_settlements(tenant_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS erp_settlements_reversal_unique ON erp_settlements(tenant_id,reverses_id) WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS erp_settlements_tenant_entry_idx ON erp_settlements(tenant_id,entry_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_closings (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), competence text NOT NULL,
  status text NOT NULL DEFAULT 'pending', snapshot jsonb NOT NULL, reason text NOT NULL,
  prepared_by text NOT NULL REFERENCES "user"(id), closed_by text REFERENCES "user"(id), closed_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_closings_tenant_competence_unique ON erp_closings(tenant_id,competence);
CREATE TABLE IF NOT EXISTS erp_offsets (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), advance_entry_id text NOT NULL, commission_entry_id text NOT NULL,
  request_id text NOT NULL, kind text NOT NULL DEFAULT 'allocation', reverses_id text,
  amount_cents bigint NOT NULL CHECK(amount_cents > 0 AND amount_cents <= 100000000000), occurred_on date NOT NULL, reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', created_by text NOT NULL REFERENCES "user"(id), reviewed_by text REFERENCES "user"(id),
  reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_offsets_tenant_id_unique UNIQUE(tenant_id,id),
  CONSTRAINT erp_offsets_advance_fk FOREIGN KEY(tenant_id,advance_entry_id) REFERENCES erp_financial_entries(tenant_id,id),
  CONSTRAINT erp_offsets_commission_fk FOREIGN KEY(tenant_id,commission_entry_id) REFERENCES erp_financial_entries(tenant_id,id),
  CONSTRAINT erp_offsets_independent_approval CHECK(reviewed_by IS NULL OR reviewed_by <> created_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_offsets_tenant_request_unique ON erp_offsets(tenant_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS erp_offsets_tenant_reversal_unique ON erp_offsets(tenant_id,reverses_id) WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS erp_offsets_tenant_advance_idx ON erp_offsets(tenant_id,advance_entry_id);
CREATE INDEX IF NOT EXISTS erp_offsets_tenant_commission_idx ON erp_offsets(tenant_id,commission_entry_id);
--> statement-breakpoint
-- No anonymous/PostgREST policies: only the trusted server DB role may use these tables.
ALTER TABLE erp_module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_implantations ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_offsets ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Once approved/confirmed, facts are immutable. Corrections use compensating events.
CREATE OR REPLACE FUNCTION erp_protect_financial_fact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('approved', 'confirmed') OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Approved ERP financial facts are immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS erp_entries_immutable ON erp_financial_entries;
CREATE TRIGGER erp_entries_immutable BEFORE UPDATE OR DELETE ON erp_financial_entries FOR EACH ROW EXECUTE FUNCTION erp_protect_financial_fact();
DROP TRIGGER IF EXISTS erp_settlements_immutable ON erp_settlements;
CREATE TRIGGER erp_settlements_immutable BEFORE UPDATE OR DELETE ON erp_settlements FOR EACH ROW EXECUTE FUNCTION erp_protect_financial_fact();
DROP TRIGGER IF EXISTS erp_offsets_immutable ON erp_offsets;
CREATE TRIGGER erp_offsets_immutable BEFORE UPDATE OR DELETE ON erp_offsets FOR EACH ROW EXECUTE FUNCTION erp_protect_financial_fact();
--> statement-breakpoint
-- Lote 2 (12/11): repasses e recibos, indicações, incentivos e parâmetros de módulo.
ALTER TABLE erp_module_settings ADD COLUMN IF NOT EXISTS params jsonb NOT NULL DEFAULT '{}';
ALTER TABLE erp_settlements ADD COLUMN IF NOT EXISTS payout_id text;
CREATE TABLE IF NOT EXISTS erp_payouts (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), request_id text NOT NULL,
  beneficiary_id text NOT NULL REFERENCES "user"(id), branch_id text REFERENCES branches(id), competence text NOT NULL,
  status text NOT NULL DEFAULT 'prepared', gross_cents bigint NOT NULL, net_cents bigint NOT NULL,
  evidence_document_id text REFERENCES erp_documents(id), occurred_on date, reason text NOT NULL DEFAULT '',
  receipt jsonb, receipt_number text, receipt_digest text,
  prepared_by text NOT NULL REFERENCES "user"(id), approved_by text REFERENCES "user"(id), approved_at timestamptz,
  paid_by text REFERENCES "user"(id), settled_by text REFERENCES "user"(id), settled_at timestamptz,
  version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_payouts_tenant_id_unique UNIQUE(tenant_id,id),
  CONSTRAINT erp_payouts_positive CHECK(net_cents > 0 AND gross_cents >= net_cents AND gross_cents <= 100000000000),
  CONSTRAINT erp_payouts_independent_approval CHECK(approved_by IS NULL OR approved_by <> prepared_by),
  CONSTRAINT erp_payouts_independent_settlement CHECK(settled_by IS NULL OR settled_by <> paid_by)
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_payouts_tenant_request_unique ON erp_payouts(tenant_id,request_id);
CREATE UNIQUE INDEX IF NOT EXISTS erp_payouts_tenant_receipt_unique ON erp_payouts(tenant_id,receipt_number) WHERE receipt_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS erp_payouts_tenant_beneficiary_idx ON erp_payouts(tenant_id,beneficiary_id,competence);
CREATE TABLE IF NOT EXISTS erp_payout_items (
  tenant_id text NOT NULL REFERENCES tenants(id), payout_id text NOT NULL, entry_id text NOT NULL, balance_cents bigint NOT NULL CHECK(balance_cents > 0),
  PRIMARY KEY (payout_id, entry_id),
  CONSTRAINT erp_payout_items_payout_fk FOREIGN KEY(tenant_id,payout_id) REFERENCES erp_payouts(tenant_id,id),
  CONSTRAINT erp_payout_items_entry_fk FOREIGN KEY(tenant_id,entry_id) REFERENCES erp_financial_entries(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS erp_payout_items_entry_idx ON erp_payout_items(tenant_id,entry_id);
CREATE OR REPLACE FUNCTION erp_protect_payout() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status IN ('settled', 'cancelled') THEN RAISE EXCEPTION 'Settled or cancelled ERP payouts are immutable'; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS erp_payouts_immutable ON erp_payouts;
CREATE TRIGGER erp_payouts_immutable BEFORE UPDATE OR DELETE ON erp_payouts FOR EACH ROW EXECUTE FUNCTION erp_protect_payout();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_referrals (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), request_id text NOT NULL,
  referrer_name text NOT NULL, referrer_user_id text REFERENCES "user"(id), referrer_contact text NOT NULL DEFAULT '',
  channel text NOT NULL, referred_name text NOT NULL, referred_phone text NOT NULL, phone_digits text NOT NULL,
  consent boolean NOT NULL DEFAULT false, notes text NOT NULL DEFAULT '',
  branch_id text REFERENCES branches(id), owner_id text NOT NULL REFERENCES "user"(id), lead_id text REFERENCES leads(id),
  status text NOT NULL DEFAULT 'registered', lost_reason text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL REFERENCES "user"(id), updated_by text NOT NULL REFERENCES "user"(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_referrals_tenant_request_unique ON erp_referrals(tenant_id,request_id);
CREATE INDEX IF NOT EXISTS erp_referrals_tenant_phone_idx ON erp_referrals(tenant_id,phone_digits);
CREATE INDEX IF NOT EXISTS erp_referrals_tenant_status_idx ON erp_referrals(tenant_id,status,created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS erp_incentive_campaigns (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), name text NOT NULL, regulation text NOT NULL,
  metric text NOT NULL, starts_on date NOT NULL, ends_on date NOT NULL, branch_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  prize text NOT NULL DEFAULT '', show_names boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'draft',
  reason text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
  created_by text NOT NULL REFERENCES "user"(id), approved_by text REFERENCES "user"(id), approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_incentive_period CHECK(ends_on >= starts_on),
  CONSTRAINT erp_incentive_independent_approval CHECK(approved_by IS NULL OR approved_by <> created_by)
);
CREATE INDEX IF NOT EXISTS erp_incentive_campaigns_tenant_idx ON erp_incentive_campaigns(tenant_id,status,starts_on);
CREATE TABLE IF NOT EXISTS erp_incentive_results (
  id text PRIMARY KEY, tenant_id text NOT NULL REFERENCES tenants(id), campaign_id text NOT NULL REFERENCES erp_incentive_campaigns(id),
  kind text NOT NULL DEFAULT 'preliminary', campaign_version integer NOT NULL, snapshot jsonb NOT NULL, digest text NOT NULL,
  created_by text NOT NULL REFERENCES "user"(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS erp_incentive_results_campaign_idx ON erp_incentive_results(tenant_id,campaign_id,created_at);
DROP TRIGGER IF EXISTS erp_incentive_results_append_only ON erp_incentive_results;
CREATE TRIGGER erp_incentive_results_append_only BEFORE UPDATE OR DELETE ON erp_incentive_results FOR EACH ROW EXECUTE FUNCTION erp_reject_event_mutation();
ALTER TABLE erp_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_incentive_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_incentive_results ENABLE ROW LEVEL SECURITY;
