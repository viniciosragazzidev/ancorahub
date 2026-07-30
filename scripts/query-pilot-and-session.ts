import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../src/shared/db/schema";

const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) { console.error("DATABASE_URL is required"); process.exit(1); }

const client = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

async function main() {
  // Get all tenants
  const tenants = await db
    .select({ id: schema.tenants.id, name: schema.tenants.name, slug: schema.tenants.slug, cnpj: schema.tenants.cnpj })
    .from(schema.tenants)
    .orderBy(schema.tenants.name);

  // Get pilot tenant IDs from system_settings
  const pilotSetting = await db
    .select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, "meta_lead_ads_pilot_tenant_ids"))
    .limit(1);

  const pilotIds: string[] = pilotSetting[0]?.value ? JSON.parse(pilotSetting[0].value) : [];

  console.log("=== PILOT TENANTS ===");
  for (const t of tenants) {
    const inPilot = pilotIds.includes(t.id);
    console.log(`${inPilot ? "✅" : "❌"} ${t.name.padEnd(30)} ${t.slug.padEnd(30)} ${(t.cnpj ?? "sem CNPJ").padEnd(18)} ID: ${t.id.slice(0, 8)}...`);
  }

  console.log("\n=== RAW PILOT IDS ===");
  console.log(pilotIds);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
