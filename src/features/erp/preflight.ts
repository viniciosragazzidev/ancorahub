import "server-only";
import { sql } from "drizzle-orm";
import type { ErpDatabase } from "./access";
import { ErpError } from "./contracts";

const TABLES = ["erp_module_settings", "erp_events", "erp_documents", "erp_imports", "erp_implantations", "erp_financial_entries", "erp_settlements", "erp_offsets", "erp_closings"];
export async function assertErpSchemaReady(db: ErpDatabase) {
  const rows = await db.execute(sql`SELECT c.relname AS name, c.relrowsecurity AS protected FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (${sql.join(TABLES.map((name) => sql`${name}`), sql`, `)})`);
  const triggers = await db.execute(sql`SELECT t.tgname AS name FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND t.tgenabled <> 'D' AND (c.relname,t.tgname) IN (('erp_events','erp_events_append_only'),('erp_financial_entries','erp_entries_immutable'),('erp_settlements','erp_settlements_immutable'),('erp_offsets','erp_offsets_immutable'))`);
  if (rows.length !== TABLES.length || rows.some((row) => row.protected !== true) || triggers.length !== 4) throw new ErpError("A estrutura do ERP ainda não está pronta. Execute e confira a migração 0230, o isolamento e os gatilhos antes de liberar os módulos.");
}
