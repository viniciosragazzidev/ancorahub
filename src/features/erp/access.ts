import "server-only";
import { cache } from "react";

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { resolveAccessContext } from "@/shared/auth/access-context";
import { getEffectiveAccess } from "@/features/custom-roles/service";
import { getSupervisedBrokerIds } from "@/features/team/supervisor-service";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import type { PermissionKey } from "@/shared/auth/permissions";
import type { TenantContext } from "@/shared/auth/types";
import { requiresMemberBranch } from "@/features/custom-roles/member-scope";
import { ERP_AUDIENCES, ERP_IMPLEMENTED_MODULES, ERP_MODULES, ErpError, erpModuleKeySchema, type ErpModuleKey } from "./contracts";
import { resolveErpScope, type ErpScope } from "./scope";

export type ErpTransaction = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];
export type ErpDatabase = ReturnType<typeof getDatabase> | ErpTransaction;

const modulesSchema = z.array(erpModuleKeySchema).max(7);
const roleListSchema = z.array(z.enum(ERP_AUDIENCES)).min(1).max(8);

export function getErpEffectiveAccess(context: TenantContext, db?: ErpDatabase) {
  return getEffectiveAccess({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null }, db);
}

export async function getErpPlatformState(db: ErpDatabase = getDatabase()) {
  const rows = await db.select({ key: schema.systemSettings.key, value: schema.systemSettings.value }).from(schema.systemSettings)
    .where(inArray(schema.systemSettings.key, [FEATURE_FLAGS.ERP_OPERATIONAL.key, FEATURE_FLAGS.ERP_MODULES.key]));
  const enabled = rows.find((row) => row.key === FEATURE_FLAGS.ERP_OPERATIONAL.key)?.value === "true";
  let modules: ErpModuleKey[] = [];
  try { const result = modulesSchema.safeParse(JSON.parse(rows.find((row) => row.key === FEATURE_FLAGS.ERP_MODULES.key)?.value ?? "[]")); if (result.success) modules = result.data; } catch { /* Invalid configuration denies access. */ }
  return { enabled, modules: modules.filter((module) => ERP_IMPLEMENTED_MODULES.has(module)) };
}

async function freshErpContext(db: ErpDatabase): Promise<TenantContext> {
  const trusted = await getRequiredTenantContext();
  const [member] = await db.select({ role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle,
    customRoleId: schema.tenantMemberships.customRoleId, customRoleScope: schema.customRoles.scope,
    branchId: schema.tenantMemberships.branchId, branchStatus: schema.branches.status,
    active: schema.user.active, userStatus: schema.user.status, membershipStatus: schema.tenantMemberships.status, tenantStatus: schema.tenants.status })
    .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.tenantMemberships.tenantId))
    .leftJoin(schema.customRoles, and(eq(schema.customRoles.id, schema.tenantMemberships.customRoleId), eq(schema.customRoles.tenantId, trusted.tenantId)))
    .leftJoin(schema.branches, and(eq(schema.branches.id, schema.tenantMemberships.branchId), eq(schema.branches.tenantId, trusted.tenantId)))
    .where(and(eq(schema.tenantMemberships.tenantId, trusted.tenantId), eq(schema.tenantMemberships.userId, trusted.userId))).limit(1);
  if (!member?.active || member.userStatus !== "active" || member.membershipStatus !== "active" || member.tenantStatus !== "active") throw new ErpError("Seu vínculo não está ativo para operar este ERP.");
  if ((member.branchId && member.branchStatus !== "active") || (requiresMemberBranch(member) && !member.branchId)) throw new ErpError("Seu vínculo precisa de uma unidade ativa.");
  return { ...trusted, role: member.role, jobTitle: member.jobTitle, customRoleId: member.customRoleId, customRoleScope: member.customRoleScope, branchId: member.branchId };
}

export async function requireErpAdmin(db: ErpDatabase = getDatabase()) {
  const context = await freshErpContext(db);
  if (context.viewAs || context.role !== "director" || context.customRoleId) throw new ErpError("Somente a direção autorizada pode administrar os módulos desta empresa.");
  return context;
}

/**
 * Everything ERP authorization needs about the viewer, loaded once. Outside a transaction it is memoized for the
 * request (navigation, layout and page share it); inside a transaction it is always reloaded with that connection.
 */
async function loadErpBase(db: ErpDatabase) {
  const context = await freshErpContext(db);
  const [platform, settings, access, trusted, supervisedIds] = await Promise.all([
    getErpPlatformState(db),
    db.select().from(schema.erpModuleSettings).where(eq(schema.erpModuleSettings.tenantId, context.tenantId)),
    getErpEffectiveAccess(context, db),
    resolveAccessContext(context, db),
    context.role === "supervisor" ? getSupervisedBrokerIds(context.tenantId, context.userId, db) : Promise.resolve([] as string[]),
  ]);
  return { context, platform, settings, access, cargo: trusted.scope, supervisedIds };
}
const requestErpBase = cache(() => loadErpBase(getDatabase()));
export type ErpBase = Awaited<ReturnType<typeof loadErpBase>>;

/** Pure decision on a loaded base: module, audience, dependencies, capability, support view and data scope. */
export function decideErpAccess(base: ErpBase, module: ErpModuleKey, capability: PermissionKey) {
  const { context, platform, settings, access } = base;
  if (!platform.enabled || !platform.modules.includes(module)) throw new ErpError("Este módulo está desativado. Solicite a ativação ao administrador.");
  const setting = settings.find((row) => row.moduleKey === module);
  const roles = roleListSchema.safeParse(setting?.roles);
  const audience = context.jobTitle || context.role;
  if (!setting?.enabled || !roles.success || !roles.data.some((role) => role === audience)) throw new ErpError("Este módulo não está liberado para seu perfil nesta empresa.");
  const dependencies = ERP_MODULES.find((definition) => definition.key === module)?.dependencies ?? [];
  if (dependencies.some((dependency) => !platform.modules.includes(dependency) || !settings.some((row) => row.moduleKey === dependency && row.enabled && row.roles.includes(audience)))) throw new ErpError("Uma capacidade necessária está desativada para seu perfil.");
  if (!access.capabilities.has(capability)) throw new ErpError("Seu cargo não permite esta operação.");
  if (context.viewAs && !ERP_READ_CAPABILITIES.has(capability)) throw new ErpError("A visualização de suporte é somente leitura.");
  const scope = resolveErpScope({ context, financial: module === "finance" || (context.jobTitle === "finance" && ["analytics", "imports", "tv"].includes(module)), supervisedIds: base.supervisedIds, cargo: base.cargo });
  if (scope.mode === "none") throw new ErpError("Seu perfil não possui um escopo de dados para esta operação.");
  if (module === "finance" && capability !== "erp_view_finance" && (!canSeeAgencyBooks(context) || scope.mode === "owners")) throw new ErpError("A operação financeira exige um cargo delegado para a unidade ou empresa.");
  return { context, scope, setting, access };
}

export async function requireErpAccess(module: ErpModuleKey, capability: PermissionKey, db?: ErpDatabase) {
  return decideErpAccess(db ? await loadErpBase(db) : await requestErpBase(), module, capability);
}

/** Read-only capabilities a support view-as session may use. */
export const ERP_READ_CAPABILITIES: ReadonlySet<PermissionKey> = new Set<PermissionKey>(["erp_view_finance", "erp_view_operations", "erp_view_analytics"]);

/** Agency books (receivables, expenses, cash, reconciliation) need a delegated finance profile on unit or tenant scope. */
export function hasAgencyScope(auth: { context: TenantContext; scope: ErpScope }) {
  return canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners";
}

/** Audit actor: during support view-as, the administrator is recorded, never the impersonated person. */
export function auditActor(context: TenantContext) { return context.viewAs?.adminUserId ?? context.userId; }

/** Every caller ALSO filters the actual table's tenantId. */
export function erpScopeSql(scope: ErpScope, branch: AnyPgColumn, owner: AnyPgColumn): SQL {
  if (scope.mode === "tenant") return sql`true`;
  if (scope.mode === "units") return scope.unitIds.length ? inArray(branch, [...scope.unitIds]) : sql`false`;
  if (scope.mode === "owners") return scope.ownerIds.length ? sql`${inArray(owner, [...scope.ownerIds])}${scope.unitIds ? sql` AND ${inArray(branch, [...scope.unitIds])}` : sql``}` : sql`false`;
  return sql`false`;
}

export async function auditErp(db: ErpDatabase, input: { tenantId: string; actorId: string; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }) {
  await db.insert(schema.erpEvents).values({ id: crypto.randomUUID(), ...input, metadata: input.metadata ?? {} });
}

export function canSeeAgencyBooks(context: Awaited<ReturnType<typeof getRequiredTenantContext>>) {
  // DEC-185: the Gestor role alone does not open the agency books; it needs the finance function with a delegated cargo.
  return context.role === "director" || (context.jobTitle === "finance" && !!context.customRoleId && ["branch", "tenant"].includes(context.customRoleScope ?? ""));
}
