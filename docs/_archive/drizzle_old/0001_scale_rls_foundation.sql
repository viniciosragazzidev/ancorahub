-- CorreTop scale foundation
-- Apply this migration only after the application is configured to call
-- withTenantTransaction() for tenant-sensitive work. The policy is fail-closed
-- when app.current_tenant_id is absent.

DO $$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'tenants', 'branches', 'carriers', 'carrier_plans',
    'plans', 'lead_webhook_credentials', 'leads', 'clients',
    'notifications', 'whatsapp_connections', 'whatsapp_messages',
    'webhook_deliveries', 'tenant_memberships'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
      EXECUTE format('DROP POLICY IF EXISTS corretop_tenant_isolation ON public.%I', table_name);

      IF table_name = 'tenants' THEN
        EXECUTE format($policy$
          CREATE POLICY corretop_tenant_isolation ON public.%I
          USING (id = current_setting('app.current_tenant_id', true))
          WITH CHECK (id = current_setting('app.current_tenant_id', true))
        $policy$, table_name);
      ELSE
        EXECUTE format($policy$
          CREATE POLICY corretop_tenant_isolation ON public.%I
          USING (tenant_id = current_setting('app.current_tenant_id', true))
          WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true))
        $policy$, table_name);
      END IF;
    END IF;
  END LOOP;
END $$;

COMMENT ON POLICY corretop_tenant_isolation ON public.leads IS
  'Defense-in-depth tenant isolation. The application must set app.current_tenant_id inside a transaction.';
