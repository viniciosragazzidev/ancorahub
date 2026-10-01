-- Tags the team puts on lead conversations (like WhatsApp Business labels):
-- a name and a color (a hue, shown as a dot, like queues). Directors and
-- managers keep the list; anyone with access to a lead tags it.
CREATE TABLE IF NOT EXISTS lead_tags (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  color_hue integer NOT NULL,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_tags_tenant_name_unique ON lead_tags (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS lead_tag_assignments (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tag_id text NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, tag_id)
);
CREATE INDEX IF NOT EXISTS lead_tag_assignments_tenant_tag_idx ON lead_tag_assignments (tenant_id, tag_id);
