import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { boolean, pgTable, text } from "drizzle-orm/pg-core";

import { getDatabase, type DatabaseExecutor } from "@/shared/db";

/**
 * "Exigir foto na confirmação" por plantão (25/11/2026). A coluna `unit_duty_schedules.presence_photo_required`
 * chega na migration 0239: null = padrão da modalidade (presencial com foto, online sem). Fica fora de
 * `schema.unitDutySchedules` de propósito, como em `leadListLinks` (DEC-191): o resto do sistema lê e grava a
 * tabela igual antes e depois da migration. Só este arquivo usa a coluna, e só depois de `isDutyPhotoSettingReady()`.
 */
export const dutySchedulePhotoColumn = pgTable("unit_duty_schedules", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
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
