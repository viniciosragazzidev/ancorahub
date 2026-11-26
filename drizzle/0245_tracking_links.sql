-- Links rastreáveis (Marketing > Links, 26/11/2026).
-- Aditiva: só cria as duas tabelas. Sem elas, a tela mostra "ainda não ligado" e /l/<codigo> manda para a
-- formulário público; o código confere com to_regclass antes de ler ou gravar.
CREATE TABLE IF NOT EXISTS tracking_links (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  destination text NOT NULL,
  whatsapp_phone text,
  whatsapp_message text,
  utm_source text NOT NULL,
  utm_medium text,
  utm_campaign text,
  status text NOT NULL DEFAULT 'active',
  created_by text REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT tracking_links_destination_check CHECK (destination IN ('whatsapp', 'form')),
  CONSTRAINT tracking_links_status_check CHECK (status IN ('active', 'paused'))
);

CREATE UNIQUE INDEX IF NOT EXISTS tracking_links_code_unique ON tracking_links (code);
CREATE INDEX IF NOT EXISTS tracking_links_tenant_idx ON tracking_links (tenant_id, created_at);

-- Cliques por dia: uma linha por link e dia (fuso de São Paulo), somada com ON CONFLICT, sem travar o redirecionamento.
CREATE TABLE IF NOT EXISTS tracking_link_clicks (
  link_id text NOT NULL REFERENCES tracking_links(id) ON DELETE CASCADE,
  day date NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, day)
);

-- Leads por link: a atribuição fica em leads.source_metadata->>'trackingLinkId'.
CREATE INDEX IF NOT EXISTS leads_tracking_link_idx ON leads ((source_metadata->>'trackingLinkId')) WHERE source_metadata ? 'trackingLinkId';
