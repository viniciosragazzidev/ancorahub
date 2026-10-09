/**
 * Gives each plantão without a type the type whose name appears in the
 * plantão name ("PLANTÃO PME 25/09" -> PME). Only active types are used and
 * only plantões without a type are touched (unless --all). Nothing else of
 * the plantão changes: hours, modality, roster and escalas stay as they are.
 *
 * Dry run by default (prints what it would do):
 *   npx tsx scripts/duty-assign-types-by-name.ts
 * Apply:
 *   npx tsx scripts/duty-assign-types-by-name.ts --apply
 * Options: --all (re-match plantões that already have a type),
 *          --include-archived (also archived plantões).
 */
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

import { matchTypeByName } from "../src/features/lead-distribution/duty-type-name-match";

if (!process.env.SUPABASE_DB_URL?.trim() && !process.env.DATABASE_URL?.trim()) {
  loadEnvConfig(process.cwd());
}

const apply = process.argv.includes("--apply");
const all = process.argv.includes("--all");
const includeArchived = process.argv.includes("--include-archived");
const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!databaseUrl) throw new Error("SUPABASE_DB_URL or DATABASE_URL is required.");

type Schedule = { id: string; tenant_id: string; name: string; type_id: string | null; status: string };
type Type = { id: string; tenant_id: string; name: string; created_by: string };

async function main() {
  const sql = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });
  try {
    const types = await sql<Type[]>`select id, tenant_id, name, created_by from duty_schedule_types where status = 'active'`;
    const schedules = await sql<Schedule[]>`
      select id, tenant_id, name, type_id, status from unit_duty_schedules
      where (${all} or type_id is null) and (${includeArchived} or status <> 'archived')
      order by tenant_id, name`;

    const typesByTenant = new Map<string, Type[]>();
    for (const type of types) typesByTenant.set(type.tenant_id, [...(typesByTenant.get(type.tenant_id) ?? []), type]);

    const updates: Array<{ schedule: Schedule; type: Type }> = [];
    const ambiguous: string[] = [];
    const unmatched = new Map<string, number>();
    for (const schedule of schedules) {
      const match = matchTypeByName(schedule.name, typesByTenant.get(schedule.tenant_id) ?? []);
      if (match.kind === "match") {
        if (schedule.type_id !== match.type.id) updates.push({ schedule, type: match.type as Type });
      } else if (match.kind === "ambiguous") {
        ambiguous.push(`${schedule.name} -> ${match.types.map((type) => type.name).join(" ou ")}`);
      } else {
        unmatched.set(schedule.name, (unmatched.get(schedule.name) ?? 0) + 1);
      }
    }

    const byType = new Map<string, number>();
    for (const { type } of updates) byType.set(type.name, (byType.get(type.name) ?? 0) + 1);
    console.log(`Plantões analisados: ${schedules.length}`);
    console.log(`Vão receber tipo: ${updates.length}`);
    for (const [name, count] of [...byType].sort()) console.log(`  ${name}: ${count}`);
    for (const { schedule, type } of updates.slice(0, 40)) console.log(`  · ${schedule.name} -> ${type.name}`);
    if (updates.length > 40) console.log(`  · ... e mais ${updates.length - 40}`);
    if (ambiguous.length) {
      console.log(`Empate (ficam sem tipo, decida na tela): ${ambiguous.length}`);
      for (const line of ambiguous) console.log(`  ? ${line}`);
    }
    if (unmatched.size) {
      console.log(`Sem tipo com nome parecido (crie o tipo e rode de novo): ${[...unmatched.values()].reduce((a, b) => a + b, 0)}`);
      for (const [name, count] of [...unmatched].slice(0, 30)) console.log(`  - ${name}${count > 1 ? ` (${count})` : ""}`);
    }

    if (!apply) {
      console.log("\nSimulação: nada foi gravado. Rode com --apply para aplicar.");
      return;
    }
    if (!updates.length) {
      console.log("Nada para aplicar.");
      return;
    }
    await sql.begin(async (tx) => {
      for (const { schedule, type } of updates) {
        // Only the type changes; the guard keeps a plantão edited meanwhile untouched.
        const changed = await tx`
          update unit_duty_schedules set type_id = ${type.id}, updated_at = now()
          where id = ${schedule.id} and tenant_id = ${schedule.tenant_id}
            and type_id is not distinct from ${schedule.type_id}
          returning id`;
        if (!changed.length) continue;
        await tx`
          insert into audit_logs (id, user_id, entidade, entidade_id, acao)
          values (${randomUUID()}, ${type.created_by}, 'unit_duty_schedule', ${schedule.id}, 'duty_schedule.type_assigned_by_name')`;
      }
    });
    console.log(`\nAplicado: ${updates.length} plantões com tipo.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
