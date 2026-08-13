import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

loadEnvConfig(process.cwd());

const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";

if (!databaseUrl) {
  console.error("SUPABASE_DB_URL or DATABASE_URL is not set.");
  process.exit(1);
}

async function main() {
  const sql = postgres(databaseUrl, { prepare: false, max: 1 });
  console.log("Configurando Supabase Realtime para todas as tabelas de eventos...");

  const tables = [
    "notifications",
    "leads",
    "lead_documents",
    "lead_tasks",
    "clients",
    "sales",
    "tenant_memberships",
  ];

  for (const table of tables) {
    try {
      await sql.unsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_publication_rel pr
            JOIN pg_publication p ON p.oid = pr.prpubid
            JOIN pg_class c ON c.oid = pr.prrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE p.pubname = 'supabase_realtime' AND n.nspname = 'public' AND c.relname = '${table}'
          ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.${table};
          END IF;
        END $$;
      `);
      await sql.unsafe(`ALTER TABLE public.${table} REPLICA IDENTITY FULL;`);
      console.log(`✓ Realtime ativado para public.${table} (REPLICA IDENTITY FULL)`);
    } catch (err) {
      console.error(`Erro ao ativar realtime para ${table}:`, err instanceof Error ? err.message : err);
    }
  }

  await sql.end();
  console.log("Configuração do Supabase Realtime concluída.");
}

main().catch(console.error);
