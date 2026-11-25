import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { boolean, pgTable, text } from "drizzle-orm/pg-core";

import { getSystemSettings, setSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema, type DatabaseExecutor } from "@/shared/db";

import { parseUnitPresencePhotoDefault, resolveDutyPhotoOverride, type UnitPresencePhotoDefault } from "./duty-presence-domain";

/**
 * "Exigir foto na confirmação" por plantão (25/11/2026). A coluna `unit_duty_schedules.presence_photo_required`
 * chega na migration 0239: null = padrão da modalidade (presencial com foto, online sem). Fica fora de
 * `schema.unitDutySchedules` de propósito, como em `leadListLinks` (DEC-191): o resto do sistema lê e grava a
 * tabela igual antes e depois da migration. Só este arquivo usa a coluna, e só depois de `isDutyPhotoSettingReady()`.
 */
export const dutySchedulePhotoColumn = pgTable("unit_duty_schedules", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  branchId: text("branch_id"),
  presencePhotoRequired: boolean("presence_photo_required"),
});

const READY_TTL_MS = 60_000;
let readyCache: { value: boolean; at: number } | null = null;

/** A migration 0239 está aplicada? Cache curto. Antes dela, tudo segue a modalidade (o comportamento de hoje). */
export async function isDutyPhotoSettingReady(now = Date.now()): Promise<boolean> {
  if (readyCache && now - readyCache.at < READY_TTL_MS) return readyCache.value;
  const value = await Promise.resolve()
    .then(() => getDatabase().execute(sql`select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'unit_duty_schedules' and column_name = 'presence_photo_required') as ready`))
    .then((result) => {
      const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as { ready?: boolean }[];
      return Boolean(rows[0]?.ready);
    })
    .catch(() => false);
  readyCache = { value, at: now };
  return value;
}

/** Só para testes. */
export function resetDutyPhotoSettingCache() {
  readyCache = null;
}

/** A escolha gravada de cada plantão (true, false ou null = padrão). Vazio antes da migration. Uma consulta. */
export async function loadSchedulePhotoRequirements(tenantId: string, scheduleIds: string[]): Promise<Map<string, boolean | null>> {
  const ids = [...new Set(scheduleIds)];
  if (!ids.length || !(await isDutyPhotoSettingReady())) return new Map();
  const rows = await getDatabase()
    .select({ id: dutySchedulePhotoColumn.id, value: dutySchedulePhotoColumn.presencePhotoRequired })
    .from(dutySchedulePhotoColumn)
    .where(and(eq(dutySchedulePhotoColumn.tenantId, tenantId), inArray(dutySchedulePhotoColumn.id, ids)))
    .catch(() => [] as { id: string; value: boolean | null }[]);
  return new Map(rows.map((row) => [row.id, row.value]));
}

/** A escolha de um plantão só (null = padrão da modalidade). */
export async function loadSchedulePhotoRequirement(tenantId: string, scheduleId: string): Promise<boolean | null> {
  return (await loadSchedulePhotoRequirements(tenantId, [scheduleId])).get(scheduleId) ?? null;
}

/**
 * Grava a escolha (já normalizada por `presencePhotoRequiredToStore`). Antes da migration não grava e avisa,
 * para a tela dizer que a opção ainda não está ligada.
 */
export async function saveSchedulePhotoRequirement(db: DatabaseExecutor, input: { tenantId: string; scheduleIds: string[]; value: boolean | null }): Promise<boolean> {
  if (!input.scheduleIds.length || !(await isDutyPhotoSettingReady())) return false;
  await db.update(dutySchedulePhotoColumn)
    .set({ presencePhotoRequired: input.value })
    .where(and(eq(dutySchedulePhotoColumn.tenantId, input.tenantId), inArray(dutySchedulePhotoColumn.id, input.scheduleIds)));
  return true;
}

/**
 * Padrão de foto por unidade (25/11), sem migration: uma linha de system_settings por unidade,
 * `duty_presence_photo_unit:<tenantId>:<branchId>` = "always" | "never" | "default". Lido do cache de
 * `getSystemSettings` (15 s); `setSystemSetting` limpa o cache deste processo na hora.
 */
const UNIT_PHOTO_PREFIX = "duty_presence_photo_unit:";

export function unitPresencePhotoSettingKey(tenantId: string, branchId: string) {
  return `${UNIT_PHOTO_PREFIX}${tenantId}:${branchId}`;
}

/** Padrão configurado de cada unidade do tenant (só as que têm "always"/"never"). */
export async function loadUnitPhotoDefaults(tenantId: string): Promise<Map<string, UnitPresencePhotoDefault>> {
  const prefix = `${UNIT_PHOTO_PREFIX}${tenantId}:`;
  // Nunca derruba a confirmação nem a tela: sem leitura, a unidade segue a modalidade.
  const rows = await Promise.resolve().then(() => getSystemSettings()).catch(() => [] as { key: string; value: string }[]);
  const defaults = new Map<string, UnitPresencePhotoDefault>();
  for (const row of rows) {
    if (!row.key.startsWith(prefix)) continue;
    const value = parseUnitPresencePhotoDefault(row.value);
    if (value) defaults.set(row.key.slice(prefix.length), value);
  }
  return defaults;
}

export async function saveUnitPhotoDefault(input: { tenantId: string; branchId: string; value: UnitPresencePhotoDefault | null }) {
  await setSystemSetting(unitPresencePhotoSettingKey(input.tenantId, input.branchId), input.value ?? "default");
}

/**
 * O que vale para cada ocorrência: `get(scheduleId, assignmentId)` devolve true/false (foto sim/não) ou null
 * (segue a modalidade), já com a precedência plantão > unidade > modalidade. A unidade é a do plantão ou,
 * no plantão de todas as unidades, a da escalação. Um `Map<scheduleId, boolean | null>` também serve (testes).
 */
export type DutyPhotoRules = { get(scheduleId: string, assignmentId?: string | null): boolean | null | undefined };

export async function loadDutyPhotoRules(tenantId: string, scheduleIds: readonly string[], assignmentIds: readonly string[] = []): Promise<DutyPhotoRules> {
  const ids = [...new Set(scheduleIds)];
  const [stored, unitDefaults] = await Promise.all([loadSchedulePhotoRequirements(tenantId, ids), loadUnitPhotoDefaults(tenantId)]);
  // Sem padrão de unidade no tenant: exatamente o comportamento anterior, sem consulta a mais.
  if (!unitDefaults.size || !ids.length) return { get: (scheduleId) => resolveDutyPhotoOverride(stored.get(scheduleId), null) };
  const assignments = [...new Set(assignmentIds)];
  const db = getDatabase();
  const [scheduleRows, assignmentRows] = await Promise.all([
    db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId }).from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, tenantId), inArray(schema.unitDutySchedules.id, ids)))
      .catch(() => [] as { id: string; branchId: string | null }[]),
    assignments.length
      ? db.select({ id: schema.dutyRosterAssignments.id, branchId: schema.dutyRosterAssignments.branchId }).from(schema.dutyRosterAssignments)
        .where(and(eq(schema.dutyRosterAssignments.tenantId, tenantId), inArray(schema.dutyRosterAssignments.id, assignments)))
        .catch(() => [] as { id: string; branchId: string }[])
      : [] as { id: string; branchId: string }[],
  ]);
  const scheduleBranch = new Map(scheduleRows.map((row) => [row.id, row.branchId]));
  const assignmentBranch = new Map(assignmentRows.map((row) => [row.id, row.branchId]));
  return {
    get(scheduleId, assignmentId) {
      const branchId = scheduleBranch.get(scheduleId) ?? (assignmentId ? assignmentBranch.get(assignmentId) : undefined);
      return resolveDutyPhotoOverride(stored.get(scheduleId), branchId ? unitDefaults.get(branchId) : null);
    },
  };
}

/** A regra de uma ocorrência só (plantão > unidade > modalidade; null = modalidade). */
export async function loadDutyPhotoRule(tenantId: string, scheduleId: string, assignmentId?: string | null): Promise<boolean | null> {
  const rules = await loadDutyPhotoRules(tenantId, [scheduleId], assignmentId ? [assignmentId] : []);
  return rules.get(scheduleId, assignmentId) ?? null;
}
