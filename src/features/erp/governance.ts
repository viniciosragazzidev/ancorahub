import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { auditErp, getErpPlatformState, requireErpAdmin } from "./access";
import { ERP_IMPLEMENTED_MODULES, ERP_MODULES, ErpError, erpModuleSettingsSchema, type ErpModuleKey } from "./contracts";

export async function getErpGovernance() {
  const context = await requireErpAdmin();
  const db = getDatabase();
  const platform = await getErpPlatformState(db);
  const [settings, events] = await Promise.all([
    db.select().from(schema.erpModuleSettings).where(eq(schema.erpModuleSettings.tenantId, context.tenantId)),
    db.select({ id: schema.erpEvents.id, action: schema.erpEvents.action, entityId: schema.erpEvents.entityId, createdAt: schema.erpEvents.createdAt, actor: schema.user.name })
      .from(schema.erpEvents).leftJoin(schema.user, eq(schema.erpEvents.actorId, schema.user.id))
      .where(and(eq(schema.erpEvents.tenantId, context.tenantId), eq(schema.erpEvents.entityType, "erp_module")))
      .orderBy(desc(schema.erpEvents.createdAt)).limit(20),
  ]);
  return {
    platform, events,
    modules: ERP_MODULES.map((module) => {
      const setting = settings.find((row) => row.moduleKey === module.key);
      return { ...module, ready: ERP_IMPLEMENTED_MODULES.has(module.key), globallyAvailable: platform.enabled && platform.modules.includes(module.key),
        enabled: setting?.enabled ?? false, roles: setting?.roles ?? ["director"],
        maxImportRows: setting?.maxImportRows ?? 100, version: setting?.version ?? 0 };
    }),
  };
}

export async function saveErpModule(raw: unknown) {
  const input = erpModuleSettingsSchema.parse(raw);
  const context = await requireErpAdmin();
  if (input.enabled && !ERP_IMPLEMENTED_MODULES.has(input.module)) throw new ErpError("Este módulo ainda está em preparação nesta versão.");
  await getDatabase().transaction(async (tx) => {
    // Serialize ERP configuration without blocking unrelated CRM foreign-key inserts.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`erp:${context.tenantId}`}, 0))`);
    await requireErpAdmin(tx);
    const [current] = await tx.select().from(schema.erpModuleSettings)
      .where(and(eq(schema.erpModuleSettings.tenantId, context.tenantId), eq(schema.erpModuleSettings.moduleKey, input.module))).limit(1);
    if ((current?.version ?? 0) !== input.expectedVersion) throw new ErpError("A configuração mudou. Atualize a página antes de salvar.");
    const definition = ERP_MODULES.find((module) => module.key === input.module);
    if (!definition) throw new ErpError("Módulo não reconhecido.");
    if (input.enabled && definition.dependencies.length) {
      const settings = await tx.select().from(schema.erpModuleSettings).where(eq(schema.erpModuleSettings.tenantId, context.tenantId));
      if (definition.dependencies.some((dependency) => !settings.some((row) => row.moduleKey === dependency && row.enabled))) throw new ErpError("Ative primeiro os módulos necessários indicados na configuração.");
    }
    const next = { enabled: input.enabled, roles: input.roles, maxImportRows: input.maxImportRows,
      version: (current?.version ?? 0) + 1, updatedBy: context.userId, updatedAt: new Date() };
    await tx.insert(schema.erpModuleSettings).values({ tenantId: context.tenantId, moduleKey: input.module, ...next })
      .onConflictDoUpdate({ target: [schema.erpModuleSettings.tenantId, schema.erpModuleSettings.moduleKey], set: next });
    await auditErp(tx, { tenantId: context.tenantId, actorId: context.userId, action: "erp.module.updated", entityType: "erp_module", entityId: input.module,
      metadata: { before: current ? { enabled: current.enabled, roles: current.roles, maxImportRows: current.maxImportRows, version: current.version } : null,
        after: { enabled: next.enabled, roles: next.roles, maxImportRows: next.maxImportRows, version: next.version } } });
  });
}

export async function listEnabledErpModulesForCurrentUser(): Promise<ErpModuleKey[]> {
  const { getRequiredTenantContext } = await import("@/shared/auth/tenant-context");
  const context = await getRequiredTenantContext();
  const platform = await getErpPlatformState();
  if (!platform.enabled) return [];
  const settings = await getDatabase().select().from(schema.erpModuleSettings).where(eq(schema.erpModuleSettings.tenantId, context.tenantId));
  const audience = context.jobTitle || context.role;
  return ERP_MODULES.filter((module) => platform.modules.includes(module.key) && settings.some((row) => row.moduleKey === module.key && row.enabled && row.roles.includes(audience))
    && module.dependencies.every((dependency) => platform.modules.includes(dependency) && settings.some((row) => row.moduleKey === dependency && row.enabled && row.roles.includes(audience))))
    .map((module) => module.key);
}
