-- Ensure all real-time tables are included in the supabase_realtime publication
-- and configured with REPLICA IDENTITY FULL for complete update payload delivery.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'lead_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_documents;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'lead_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'clients'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = 'tenant_memberships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_memberships;
  END IF;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.lead_documents REPLICA IDENTITY FULL;
ALTER TABLE public.lead_tasks REPLICA IDENTITY FULL;
ALTER TABLE public.clients REPLICA IDENTITY FULL;
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.tenant_memberships REPLICA IDENTITY FULL;
