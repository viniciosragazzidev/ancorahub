import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getAssignableCapabilities, type CustomRoleScope } from "./catalog";
import { PERMISSIONS, type PermissionKey, hasCapability } from "@/shared/auth/permissions";

const roleInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  color: z.enum(["primary", "emerald", "blue", "amber", "rose"]),
  icon: z.enum(["shield", "chart", "megaphone", "wallet", "headphones"]),
  scope: z.enum(["none", "own", "branch", "tenant"]),
  permissions: z.array(z.string()).max(40),
  status: z.enum(["draft", "active"]),
});

async function requireDirector() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") throw new Error("Somente o Diretor pode gerenciar cargos e permissões.");
  return context;
}

export async function isCustomRolesEnabled(tenantId: string) {
  if ((await getSystemSetting("feature_custom_roles_enabled")) !== "true") return false;
  const [setting] = await getDatabase().select({ enabled: schema.tenantCustomRoleSettings.enabled })
    .from(schema.tenantCustomRoleSettings).where(eq(schema.tenantCustomRoleSettings.tenantId, tenantId)).limit(1);
  return setting?.enabled === true;
}

import type { TenantRole } from "@/shared/db/schema";

/** Resolves the effective capability server-side. A custom role replaces, never augments, legacy grants. */
export async function hasEffectiveCapability(input: { tenantId: string; role: TenantRole; jobTitle: string; customRoleId: string | null; permission: PermissionKey }) {
  if (!input.customRoleId || !(await isCustomRolesEnabled(input.tenantId))) {
    return hasCapability(input.role, input.permission, input.jobTitle);
  }
  const [role] = await getDatabase().select({ id: schema.customRoles.id, status: schema.customRoles.status })
    .from(schema.customRoles).where(and(eq(schema.customRoles.id, input.customRoleId), eq(schema.customRoles.tenantId, input.tenantId))).limit(1);
  if (!role || role.status !== "active") return false;
  const [grant] = await getDatabase().select({ id: schema.customRolePermissions.id }).from(schema.customRolePermissions)
    .where(and(eq(schema.customRolePermissions.customRoleId, role.id), eq(schema.customRolePermissions.permissionKey, input.permission))).limit(1);
  return Boolean(grant);
}

export async function listEffectiveCapabilities(input: { tenantId: string; role: TenantRole; jobTitle: string; customRoleId: string | null }) {
  if (!input.customRoleId || !(await isCustomRolesEnabled(input.tenantId))) {
    return (Object.keys(PERMISSIONS) as PermissionKey[]).filter((permission) => hasCapability(input.role, permission, input.jobTitle));
  }
  const [role] = await getDatabase().select({ id: schema.customRoles.id, status: schema.customRoles.status })
    .from(schema.customRoles).where(and(eq(schema.customRoles.id, input.customRoleId), eq(schema.customRoles.tenantId, input.tenantId))).limit(1);
  if (!role || role.status !== "active") return [];
  const grants = await getDatabase().select({ key: schema.customRolePermissions.permissionKey })
    .from(schema.customRolePermissions).where(eq(schema.customRolePermissions.customRoleId, role.id));
  return grants.map((grant) => grant.key as PermissionKey);
}

/** Creates the tenant-local default used for the Marketing pilot without widening access. */
export async function provisionDefaultMarketingRole(input: { tenantId: string; actorUserId: string }) {
  const db = getDatabase();
  const [existing] = await db.select({ id: schema.customRoles.id })
    .from(schema.customRoles).where(and(eq(schema.customRoles.tenantId, input.tenantId), eq(schema.customRoles.name, "Marketing"))).limit(1);
  if (existing) return existing.id;

  const id = randomUUID();
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.insert(schema.customRoles).values({ id, tenantId: input.tenantId, name: "Marketing", description: "Acesso restrito às integrações e importações de marketing.", color: "blue", icon: "megaphone", scope: "tenant", status: "active", version: 1, createdBy: input.actorUserId, createdAt: now, updatedAt: now }).onConflictDoNothing();
    await tx.insert(schema.customRolePermissions).values({ id: randomUUID(), customRoleId: id, permissionKey: "ver_importacoes_meta", createdAt: now }).onConflictDoNothing();
    await tx.insert(schema.customRoleEvents).values({ id: randomUUID(), tenantId: input.tenantId, customRoleId: id, actorUserId: input.actorUserId, action: "custom_role.default_marketing_created", version: 1, snapshot: { permissions: ["ver_importacoes_meta"], scope: "tenant" }, createdAt: now });
  });
  return id;
}

function validatePermissions(scope: CustomRoleScope, permissions: string[]) {
  const allowed = new Set(getAssignableCapabilities(scope).map((item) => item.key));
  const invalid = permissions.filter((permission) => !allowed.has(permission as PermissionKey));
  if (invalid.length) throw new Error("Há permissões incompatíveis com o escopo seguro escolhido.");
  return [...new Set(permissions)] as PermissionKey[];
}

async function writeEvent(input: { tenantId: string; customRoleId: string; actorUserId: string; action: string; version: number; snapshot: Record<string, unknown> }) {
  await getDatabase().insert(schema.customRoleEvents).values({ id: randomUUID(), ...input });
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "custom_role", entidadeId: input.customRoleId, acao: input.action });
}

export async function getCustomRolesWorkspace() {
  const context = await requireDirector();
  const db = getDatabase();
  const [enabled, roles, members] = await Promise.all([
    isCustomRolesEnabled(context.tenantId),
    db.select().from(schema.customRoles).where(eq(schema.customRoles.tenantId, context.tenantId)),
    db.select({ customRoleId: schema.tenantMemberships.customRoleId, count: schema.tenantMemberships.id })
      .from(schema.tenantMemberships).where(eq(schema.tenantMemberships.tenantId, context.tenantId)),
  ]);
  const counts = new Map<string, number>();
  for (const member of members) if (member.customRoleId) counts.set(member.customRoleId, (counts.get(member.customRoleId) ?? 0) + 1);
  const roleIds = roles.map((role) => role.id);
  const permissions = roleIds.length ? await db.select().from(schema.customRolePermissions).where(inArray(schema.customRolePermissions.customRoleId, roleIds)) : [];
  return {
    enabled,
    catalog: getAssignableCapabilities("none").concat(getAssignableCapabilities("own"), getAssignableCapabilities("branch"), getAssignableCapabilities("tenant"))
      .filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index),
    roles: roles.map((role) => ({ ...role, memberCount: counts.get(role.id) ?? 0, permissions: permissions.filter((item) => item.customRoleId === role.id).map((item) => item.permissionKey) })),
  };
}

export async function saveCustomRole(raw: unknown) {
  const context = await requireDirector();
  if (!(await isCustomRolesEnabled(context.tenantId))) throw new Error("O piloto de cargos personalizados não está habilitado para esta empresa.");
  const input = roleInput.parse(raw);
  const permissions = validatePermissions(input.scope, input.permissions);
  const db = getDatabase();
  const now = new Date();
  const existing = input.id ? (await db.select().from(schema.customRoles).where(and(eq(schema.customRoles.id, input.id), eq(schema.customRoles.tenantId, context.tenantId))).limit(1))[0] : null;
  if (input.id && !existing) throw new Error("Cargo não encontrado.");
  const id = existing?.id ?? randomUUID();
  const version = (existing?.version ?? 0) + 1;
  await db.transaction(async (tx) => {
    const values = { name: input.name, description: input.description || null, color: input.color, icon: input.icon, scope: input.scope, status: input.status, version, archivedAt: null, updatedAt: now } as const;
    if (existing) await tx.update(schema.customRoles).set(values).where(eq(schema.customRoles.id, id));
    else await tx.insert(schema.customRoles).values({ id, tenantId: context.tenantId, createdBy: context.userId, createdAt: now, ...values });
    await tx.delete(schema.customRolePermissions).where(eq(schema.customRolePermissions.customRoleId, id));
    if (permissions.length) await tx.insert(schema.customRolePermissions).values(permissions.map((permissionKey) => ({ id: randomUUID(), customRoleId: id, permissionKey, createdAt: now })));
  });
  await writeEvent({ tenantId: context.tenantId, customRoleId: id, actorUserId: context.userId, action: existing ? "custom_role.updated" : "custom_role.created", version, snapshot: { name: input.name, scope: input.scope, status: input.status, permissions } });
  return { id };
}

export async function archiveCustomRole(roleId: string) {
  const context = await requireDirector();
  const db = getDatabase();
  const [role] = await db.select().from(schema.customRoles).where(and(eq(schema.customRoles.id, roleId), eq(schema.customRoles.tenantId, context.tenantId))).limit(1);
  if (!role) throw new Error("Cargo não encontrado.");
  const version = role.version + 1;
  await db.transaction(async (tx) => {
    await tx.update(schema.customRoles).set({ status: "archived", archivedAt: new Date(), version, updatedAt: new Date() }).where(eq(schema.customRoles.id, role.id));
    await tx.update(schema.tenantMemberships).set({ customRoleId: null, updatedAt: new Date() }).where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.customRoleId, role.id)));
  });
  await writeEvent({ tenantId: context.tenantId, customRoleId: role.id, actorUserId: context.userId, action: "custom_role.archived", version, snapshot: { reassignedToLegacy: true } });
}

export async function assignCustomRole(memberId: string, customRoleId: string | null) {
  const context = await requireDirector();
  const db = getDatabase();
  const [member] = await db.select().from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.id, memberId), eq(schema.tenantMemberships.tenantId, context.tenantId))).limit(1);
  if (!member || member.role === "director" || member.userId === context.userId) throw new Error("Este acesso não pode ter o cargo alterado.");
  if (customRoleId) {
    const [role] = await db.select().from(schema.customRoles).where(and(eq(schema.customRoles.id, customRoleId), eq(schema.customRoles.tenantId, context.tenantId), eq(schema.customRoles.status, "active"))).limit(1);
    if (!role) throw new Error("Escolha um cargo ativo da própria empresa.");
  }
  await db.update(schema.tenantMemberships).set({ customRoleId, updatedAt: new Date() }).where(eq(schema.tenantMemberships.id, member.id));
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "tenant_membership", entidadeId: member.id, acao: customRoleId ? "custom_role.assigned" : "custom_role.removed" });
}
