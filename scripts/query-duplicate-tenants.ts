import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/shared/db/schema";

const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

async function main() {
  // Query all tenants
  const tenants = await db
    .select({
      id: schema.tenants.id,
      name: schema.tenants.name,
      slug: schema.tenants.slug,
      cnpj: schema.tenants.cnpj,
      status: schema.tenants.status,
      createdAt: schema.tenants.createdAt,
      subscriptionPlan: schema.tenants.subscriptionPlan,
      brandColor: schema.tenants.brandColor,
    })
    .from(schema.tenants)
    .orderBy(schema.tenants.name);

  console.log("=== ALL TENANTS ===");
  console.log(JSON.stringify(tenants, null, 2));

  // Find duplicates by name
  const nameCount = new Map<string, number>();
  for (const t of tenants) {
    nameCount.set(t.name, (nameCount.get(t.name) ?? 0) + 1);
  }

  console.log("\n=== DUPLICATE NAMES ===");
  for (const [name, count] of nameCount) {
    if (count > 1) {
      console.log(`  "${name}" appears ${count} times`);
    }
  }

  // Count related data for each tenant
  for (const t of tenants) {
    console.log(`\n--- ${t.name} (${t.id}) ---`);
    
    const branchCount = await db
      .select({ count: schema.branches.id })
      .from(schema.branches)
      .where(eq(schema.branches.tenantId, t.id))
      .then((r) => r.length);
    console.log(`  Branches: ${branchCount}`);

    const leadCount = await db
      .select({ count: schema.leads.id })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, t.id))
      .then((r) => r.length);
    console.log(`  Leads: ${leadCount}`);

    const memberCount = await db
      .select({ count: schema.tenantMemberships.id })
      .from(schema.tenantMemberships)
      .where(eq(schema.tenantMemberships.tenantId, t.id))
      .then((r) => r.length);
    console.log(`  Members: ${memberCount}`);

    const carrierCount = await db
      .select({ count: schema.carriers.id })
      .from(schema.carriers)
      .where(eq(schema.carriers.tenantId, t.id))
      .then((r) => r.length);
    console.log(`  Carriers: ${carrierCount}`);
    
    const planCount = await db
      .select({ count: schema.carrierPlans.id })
      .from(schema.carrierPlans)
      .where(eq(schema.carrierPlans.tenantId, t.id))
      .then((r) => r.length);
    console.log(`  Plans: ${planCount}`);
  }

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
