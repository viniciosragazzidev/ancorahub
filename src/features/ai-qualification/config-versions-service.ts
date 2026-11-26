import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { aiConfigTablesReady } from "./config-tables";
import { parseConfigSnapshot, restoreInputFrom, summarizeConfigChange } from "./config-versions-core";
import { getQualificationTenantSettings, updateQualificationTenantSettings, updateTenantSettingsSchema, type UpdateTenantSettingsInput } from "./tenant-settings-service";

export type ConfigVersionRow = {
  version: number;
  createdAt: string;
  createdByName: string | null;
  summary: string;
  restoredFromVersion: number | null;
  current: boolean;
};

export type ConfigVersionsResult = { ready: false } | { ready: true; versions: ConfigVersionRow[] };

const LIST_LIMIT = 50;

/** As últimas versões do tenant, da mais nova para a mais velha, com quem salvou e o que mudou em uma linha. */
export async function listConfigVersions(tenantId: string): Promise<ConfigVersionsResult> {
  const ready = await aiConfigTablesReady();
  if (!ready.versions) return { ready: false };
  const table = schema.aiQualificationConfigVersions;
  const rows = await getDatabase().select({
    version: table.version,
    changedFields: table.changedFields,
    restoredFromVersion: table.restoredFromVersion,
    createdAt: table.createdAt,
    createdByName: schema.user.name,
  }).from(table)
    .leftJoin(schema.user, eq(schema.user.id, table.createdBy))
    .where(eq(table.tenantId, tenantId))
    .orderBy(desc(table.version))
    .limit(LIST_LIMIT);
  const oldest = rows.length ? rows[rows.length - 1].version : null;
  return {
    ready: true,
    versions: rows.map((row, index) => ({
      version: row.version,
      createdAt: (row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt)).toISOString(),
      createdByName: row.createdByName ?? null,
      summary: summarizeConfigChange({
        changed: Array.isArray(row.changedFields) ? (row.changedFields as string[]) : [],
        restoredFromVersion: row.restoredFromVersion,
        first: rows.length < LIST_LIMIT && row.version === oldest && !(Array.isArray(row.changedFields) && row.changedFields.length),
      }),
      restoredFromVersion: row.restoredFromVersion,
      current: index === 0,
    })),
  };
}

/**
 * "Restaurar como nova versão": copia a versão antiga para uma versão nova (nunca apaga). O interruptor da IA fica
 * como está. Erra se a migration não foi aplicada ou a versão não existe.
 */
export async function restoreConfigVersion(tenantId: string, actorUserId: string, version: number) {
  const ready = await aiConfigTablesReady();
  if (!ready.versions) throw new Error("versions_unavailable");
  const table = schema.aiQualificationConfigVersions;
  const [row] = await getDatabase().select({ snapshot: table.snapshot }).from(table)
    .where(and(eq(table.tenantId, tenantId), eq(table.version, version))).limit(1);
  if (!row) throw new Error("version_not_found");
  const current = await getQualificationTenantSettings(tenantId);
  const base: UpdateTenantSettingsInput = updateTenantSettingsSchema.parse({
    enabled: current?.enabled ?? false,
    pauseMode: current?.pauseMode,
    assistantName: current?.assistantName,
    initialMessage: current?.initialMessage,
    handoffMessage: current?.handoffMessage,
    outOfHoursMessage: current?.outOfHoursMessage,
    absenceMessage: current?.absenceMessage,
    tone: current?.tone,
    useEmojis: current?.useEmojis,
    timeoutMinutes: current?.timeoutMinutes,
    businessContext: current?.businessContext ?? "",
    customInstructions: current?.customInstructions ?? "",
    quickReplyCooldownMinutes: current?.quickReplyCooldownMinutes,
    quickReplyWaitWindowMinutes: current?.quickReplyWaitWindowMinutes,
    quickReplyWaitLimitCount: current?.quickReplyWaitLimitCount,
  });
  const input = updateTenantSettingsSchema.parse(restoreInputFrom(parseConfigSnapshot(row.snapshot), base));
  return updateQualificationTenantSettings(tenantId, actorUserId, input, { restoredFromVersion: version });
}
