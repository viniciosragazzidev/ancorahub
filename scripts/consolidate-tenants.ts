import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/shared/db/schema";

const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) { console.error("DATABASE_URL is required"); process.exit(1); }

const client = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(client, { schema });

const OLD = "65bc6d4e-493a-48cb-a68b-0bc202180ecc";
const NEW = "9a13afb3-6c69-491a-921f-ceb3f66d3316";

const TABLES = [
  "leads", "lead_queues", "lead_distribution_settings", "lead_distribution_events",
  "lead_distribution_jobs", "lead_tasks", "lead_task_assignees", "quotes",
  "quote_line_items", "lead_feedbacks", "lead_assignment_attempts", "notifications",
  "lead_beneficiaries", "clients", "lead_webhook_credentials", "communication_channels",
  "meta_lead_ad_sources", "whatsapp_connections", "ai_qualification_configs",
  "ai_qualification_sessions", "agent_behavior_versions", "agent_training_simulations",
  "route_onboarding_progress", "unit_duty_schedules", "duty_roster_assignments",
  "feedback_checklist_templates", "feedback_checklist_items",
  "webhook_deliveries",
];

async function main() {
  if (process.argv.includes("--dry-run")) {
    const bc = await db.select({ id: schema.branches.id }).from(schema.branches).where(eq(schema.branches.tenantId, OLD)).then(r => r.length);
    const lc = await db.select({ id: schema.leads.id }).from(schema.leads).where(eq(schema.leads.tenantId, OLD)).then(r => r.length);
    const mc = await db.select({ id: schema.tenantMemberships.id }).from(schema.tenantMemberships).where(eq(schema.tenantMemberships.tenantId, OLD)).then(r => r.length);
    console.log(`Duplicate: ${OLD}\nPrimary: ${NEW}\nBranches: ${bc}, Leads: ${lc}, Members: ${mc}`);
    await client.end();
    return;
  }

  console.log("🔍 Migrando dados do tenant duplicado...");
  
  await client.begin(async (tx) => {
    // 1. Clear FK refs, move memberships, move branches
    await tx`UPDATE tenant_memberships SET branch_id = NULL WHERE tenant_id = ${OLD}`;
    const m = await tx`UPDATE tenant_memberships SET tenant_id = ${NEW} WHERE tenant_id = ${OLD}`;
    console.log(`✅ Membresias: ${m.count}`);
    
    const b = await tx`UPDATE branches SET tenant_id = ${NEW} WHERE tenant_id = ${OLD}`;
    console.log(`✅ Branches: ${b.count}`);

    // 2. All data tables — tx(table) inside tagged template quotes as identifier
    for (const table of TABLES) {
      const result = await tx`
        UPDATE ${tx(table)} SET tenant_id = ${NEW} WHERE tenant_id = ${OLD}
      `;
      if (result.count > 0) console.log(`  ${table}: ${result.count}`);
    }
    console.log("✅ Dados migrados");

    // 3. Update pilot list
    const [row] = await tx`SELECT value FROM system_settings WHERE key = 'meta_lead_ads_pilot_tenant_ids'`;
    const ids: string[] = JSON.parse(row?.value ?? "[]");
    const updated = [...new Set(ids.map((id: string) => id === OLD ? NEW : id))];
    await tx`UPDATE system_settings SET value = ${JSON.stringify(updated)} WHERE key = 'meta_lead_ads_pilot_tenant_ids'`;
    console.log("✅ Piloto atualizado");

    // 4. Cleanup
    await tx`DELETE FROM tenant_custom_role_settings WHERE tenant_id = ${OLD}`;
    await tx`DELETE FROM tenant_catalog_plan_settings WHERE tenant_id = ${OLD}`;
    await tx`DELETE FROM branch_catalog_plan_restrictions WHERE tenant_id = ${OLD}`;
    await tx`DELETE FROM catalog_change_sets WHERE target_tenant_id = ${OLD}`;

    // 5. Delete duplicate
    const d = await tx`DELETE FROM tenants WHERE id = ${OLD}`;
    console.log(`✅ Tenant removido: ${d.count}`);
  });

  console.log("\n🎉 Migração concluída!");
  const r = await client`SELECT id FROM tenants WHERE id = ${OLD}`;
  console.log(`Duplicado existe: ${r.length > 0 ? "❌ SIM" : "✅ NÃO"}`);
  await client.end();
}

main().catch((err) => { console.error("❌", err); client.end(); process.exit(1); });
