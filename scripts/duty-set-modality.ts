/**
 * Sets the modality (Online / Presencial) of the plantões of one type from a
 * date on. Plantões that already started (today's, or a weekly rule valid
 * before that date) are never touched: switching to Presencial pauses the
 * brokers until the gestor releases them, so it must not happen mid-shift.
 * The type's own default modality follows.
 *
 * Simulation by default:
 *   npx tsx scripts/duty-set-modality.ts --type Presencial --modalidade presencial
 * Apply:
 *   npx tsx scripts/duty-set-modality.ts --type Presencial --modalidade presencial --apply
 * Options: --from YYYY-MM-DD (default: tomorrow, São Paulo) · --tenant <id>
 */
import { randomUUID } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/shared/db/schema";
import { addDays, localDateKey, zonedMidnight } from "../src/features/lead-distribution/monthly-duty-plan";

if (!process.env.SUPABASE_DB_URL?.trim() && !process.env.DATABASE_URL?.trim()) loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const apply = args.includes("--apply");
const typeName = option("--type");
const modality = option("--modalidade");
const TZ = "America/Sao_Paulo";
if (!typeName) throw new Error("Informe --type (ex.: Presencial).");
if (modality !== "presencial" && modality !== "online") throw new Error("--modalidade aceita presencial ou online.");
const fromKey = option("--from") ?? addDays(localDateKey(new Date(), TZ), 1);
if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey)) throw new Error("--from precisa ser YYYY-MM-DD.");
if (fromKey <= localDateKey(new Date(), TZ)) throw new Error("--from precisa ser a partir de amanhã: plantões de hoje não mudam de modalidade.");

const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
if (!databaseUrl) throw new Error("SUPABASE_DB_URL ou DATABASE_URL é obrigatório.");

async function main() {
  const client = postgres(databaseUrl, { prepare: false, max: 1, connect_timeout: 15 });
  const db = drizzle(client, { schema });
  try {
    const tenantOption = option("--tenant");
    const types = await db.select().from(schema.dutyScheduleTypes)
      .where(and(sql`lower(${schema.dutyScheduleTypes.name}) = lower(${typeName})`, eq(schema.dutyScheduleTypes.status, "active"), tenantOption ? eq(schema.dutyScheduleTypes.tenantId, tenantOption) : undefined));
    if (!types.length) throw new Error(`Tipo "${typeName}" não encontrado.`);
    if (types.length > 1) throw new Error(`Há ${types.length} empresas com o tipo "${typeName}". Informe --tenant.`);
    const type = types[0];
    const fromInstant = zonedMidnight(fromKey, TZ);

    const rows = await db.select({
      id: schema.unitDutySchedules.id, name: schema.unitDutySchedules.name, mode: schema.unitDutySchedules.attendanceMode,
      validFrom: schema.unitDutySchedules.validFrom, validUntil: schema.unitDutySchedules.validUntil, status: schema.unitDutySchedules.status,
    }).from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, type.tenantId), eq(schema.unitDutySchedules.typeId, type.id), ne(schema.unitDutySchedules.status, "archived"), ne(schema.unitDutySchedules.attendanceMode, modality!)));
    // Only plantões that start on/after `from` and have not ended: never one already running.
    const toChange = rows.filter((row) => row.validFrom.getTime() >= fromInstant.getTime());
    const runningOrPast = rows.filter((row) => row.validFrom.getTime() < fromInstant.getTime() && (!row.validUntil || row.validUntil.getTime() > Date.now()));

    const label = (row: (typeof rows)[number]) => `${row.name} (${localDateKey(row.validFrom, TZ).slice(8, 10)}/${localDateKey(row.validFrom, TZ).slice(5, 7)}${row.status !== "active" ? `, ${row.status}` : ""})`;
    console.log(`Tipo ${type.name} (empresa ${type.tenantId}): ${rows.length} plantões ainda não estão como ${modality}.`);
    console.log(`Vão mudar para ${modality} (começam a partir de ${fromKey.slice(8, 10)}/${fromKey.slice(5, 7)}): ${toChange.length}`);
    for (const row of toChange) console.log(`  · ${label(row)}`);
    if (runningOrPast.length) {
      console.log(`Não mudam (começaram antes, inclusive hoje ou regra semanal em vigor): ${runningOrPast.length}`);
      for (const row of runningOrPast) console.log(`  - ${label(row)}`);
    }
    console.log(`Modalidade padrão do tipo: ${type.attendanceMode}${type.attendanceMode === modality ? "" : ` -> ${modality}`}.`);
    if (!apply) { console.log("\nSimulação: nada foi gravado. Rode com --apply para aplicar."); return; }

    const [director] = await db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, type.tenantId), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active"))).limit(1);
    if (!director) throw new Error("Nenhum Diretor ativo para registrar a auditoria.");
    await db.transaction(async (tx) => {
      const now = new Date();
      if (toChange.length) {
        await tx.update(schema.unitDutySchedules).set({ attendanceMode: modality!, updatedAt: now })
          .where(and(eq(schema.unitDutySchedules.tenantId, type.tenantId), inArray(schema.unitDutySchedules.id, toChange.map((row) => row.id))));
        await tx.insert(schema.auditLogs).values(toChange.map((row) => ({ id: randomUUID(), userId: director.id, entidade: "unit_duty_schedule", entidadeId: row.id, acao: `duty_schedule.modality_set:${modality}` })));
      }
      if (type.attendanceMode !== modality) {
        await tx.update(schema.dutyScheduleTypes).set({ attendanceMode: modality!, updatedAt: now }).where(eq(schema.dutyScheduleTypes.id, type.id));
      }
    });
    console.log(`\nAplicado: ${toChange.length} plantões agora são ${modality}; tipo ${type.name} com padrão ${modality}.`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
