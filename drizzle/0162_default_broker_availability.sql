-- Default broker availability (2026-09-26): every broker starts available
-- 08:00–19:00 on every day of the week. The database seeds it, so every path
-- that adds a broker (invite, /equipe, platform admin, scripts, or a role
-- change to broker) gets it. A broker who already has a schedule in that
-- tenant keeps it, and anyone can change it later in Configurações.
CREATE OR REPLACE FUNCTION seed_default_broker_availability() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role = 'broker' AND NOT EXISTS (
    SELECT 1 FROM broker_availability_windows w
    WHERE w.tenant_id = NEW.tenant_id AND w.broker_id = NEW.user_id
  ) THEN
    INSERT INTO broker_availability_windows (id, tenant_id, broker_id, day_of_week, starts_at, ends_at)
    SELECT gen_random_uuid()::text, NEW.tenant_id, NEW.user_id, day, '08:00', '19:00'
    FROM generate_series(0, 6) AS day
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tenant_memberships_default_broker_availability ON tenant_memberships;
--> statement-breakpoint
CREATE TRIGGER tenant_memberships_default_broker_availability
  AFTER INSERT OR UPDATE OF role ON tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION seed_default_broker_availability();
