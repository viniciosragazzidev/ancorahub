import "server-only";

import { randomUUID } from "node:crypto";
import { cache } from "react";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema, type DatabaseExecutor } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getAssignableCapabilities, type CustomRoleScope } from "./catalog";
import { getRouteDefinitionByKey, isRoutePermission, routeCatalog, routePermissionKey, type RouteDefinition } from "./routes";
import { AREAS_SEM_CORTE_FINO } from "./presets";
import { canAccessRoute, resolveEffectiveAccess, type CargoAtribuido, type EffectiveAccess } from "./effective-access";
import { hasCapability, type PermissionKey } from "@/shared/auth/permissions";

const roleInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  color: z.enum(["primary", "emerald", "blue", "amber", "rose"]),
  icon: z.enum(["shield", "chart", "megaphone", "wallet", "headphones"]),
  scope: z.enum(["none", "own", "branch", "tenant"]),
  permissions: z.array(z.string()).max(100),
  status: z.enum(["draft", "active"]),
});

async function requireDirector() {
  const context = await getRequiredTenantContext();
  // Diretor com cargo (ex.: Plantões) não mexe em cargos: senão tiraria a própria restrição (04/11).
  if (context.role !== "director" || context.customRoleId) throw new Error("Somente o Diretor pode gerenciar cargos e permissões.");
  return context;
}

export async function isCustomRolesEnabled(tenantId: string) {
  if ((await getSystemSetting("feature_custom_roles_enabled")) !== "true") return false;
  const [setting] = await getDatabase().select({ enabled: schema.tenantCustomRoleSettings.enabled })
    .from(schema.tenantCustomRoleSettings).where(eq(schema.tenantCustomRoleSettings.tenantId, tenantId)).limit(1);
  return setting?.enabled === true;
}

import type { TenantRole } from "@/shared/db/schema";

/**
 * Cargo atribuído (status + chaves), uma leitura por request. 04/11: o cargo vale sempre que estiver
 * atribuído, mesmo com o piloto desligado (desligar não pode soltar quem tem restrição); o piloto só
 * controla criar e editar cargos na tela.
 */
async function readCargo(tenantId: string, customRoleId: string, db: DatabaseExecutor): Promise<CargoAtribuido> {
  const [role] = await db.select({ id: schema.customRoles.id, status: schema.customRoles.status })
    .from(schema.customRoles)
    .where(and(eq(schema.customRoles.id, customRoleId), eq(schema.customRoles.tenantId, tenantId)))
    .limit(1);
  // Cargo que sumiu ou é de outra empresa: trata como cargo sem nada liberado (fail closed).
  if (!role) return { status: "missing", permissions: [] };
  const grants = await db.select({ key: schema.customRolePermissions.permissionKey })
    .from(schema.customRolePermissions)
    .where(eq(schema.customRolePermissions.customRoleId, role.id));
  return { status: role.status, permissions: grants.map((grant) => grant.key) };
}
const loadCargo = cache((tenantId: string, customRoleId: string) => readCargo(tenantId, customRoleId, getDatabase()));

/** F2 no ar (04/11): ações de equipe, distribuição, plantões e importação checam o cargo; POST fora das telas do cargo é negado. */
export const CARGO_PROTEGE_ACOES = true;

type AccessInput = { tenantId: string; role: TenantRole; jobTitle: string; customRoleId: string | null };

/** Fonte única do acesso efetivo no servidor: papel, ou papel ∩ cargo. */
export async function getEffectiveAccess(input: AccessInput, db?: DatabaseExecutor): Promise<EffectiveAccess> {
  const cargo = input.customRoleId ? await (db ? readCargo(input.tenantId, input.customRoleId, db) : loadCargo(input.tenantId, input.customRoleId)) : null;
  return resolveEffectiveAccess({ role: input.role, jobTitle: input.jobTitle, cargo });
}

export async function hasEffectiveCapability(input: AccessInput & { permission: PermissionKey }) {
  return (await getEffectiveAccess(input)).capabilities.has(input.permission);
}

export async function listEffectiveCapabilities(input: AccessInput, db?: DatabaseExecutor) {
  return [...(await getEffectiveAccess(input, db)).capabilities];
}

export async function listEffectiveRoutes(input: { tenantId: string; customRoleId: string | null }) {
  if (!input.customRoleId) return [];
  const cargo = await loadCargo(input.tenantId, input.customRoleId);
  return cargo && cargo.status === "active" ? cargo.permissions.filter(isRoutePermission) : [];
}

export async function hasEffectiveRouteAccess(input: AccessInput & { routeKey: string; fallbackPermission?: PermissionKey }) {
  const definition = getRouteDefinitionByKey(input.routeKey);
  return canAccessRoute(await getEffectiveAccess(input), definition ?? (input.fallbackPermission ? {
    key: input.routeKey, path: "", label: "", description: "", category: "", fallbackPermission: input.fallbackPermission,
  } : undefined));
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
  const allowedRoutes = new Set(routeCatalog.map((route) => routePermissionKey(route.key)));
  const invalid = permissions.filter((permission) => !allowed.has(permission as PermissionKey) && !allowedRoutes.has(permission));
  if (invalid.length) throw new Error("Há permissões incompatíveis com o escopo seguro escolhido.");
  return [...new Set(permissions)];
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
    db.select({ customRoleId: schema.tenantMemberships.customRoleId, count: schema.tenantMemberships.id, id: schema.tenantMemberships.id, name: schema.user.name, role: schema.tenantMemberships.role })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(eq(schema.tenantMemberships.tenantId, context.tenantId)),
  ]);
  const counts = new Map<string, number>();
  for (const member of members) if (member.customRoleId) counts.set(member.customRoleId, (counts.get(member.customRoleId) ?? 0) + 1);
  const roleIds = roles.map((role) => role.id);
  const permissions = roleIds.length ? await db.select().from(schema.customRolePermissions).where(inArray(schema.customRolePermissions.customRoleId, roleIds)) : [];
  return {
    enabled,
    catalog: getAssignableCapabilities("none").concat(getAssignableCapabilities("own"), getAssignableCapabilities("branch"), getAssignableCapabilities("tenant"))
      .filter((item, index, list) => list.findIndex((candidate) => candidate.key === item.key) === index),
    routeCatalog,
    roles: roles.map((role) => ({ ...role, memberCount: counts.get(role.id) ?? 0, members: members.filter((member) => member.customRoleId === role.id).map((member) => ({ id: member.id, name: member.name, role: member.role })), permissions: permissions.filter((item) => item.customRoleId === role.id).map((item) => item.permissionKey) })),
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
  // Arquivar devolveria as pessoas ao papel base, ampliando o acesso delas: tira o cargo de cada uma antes.
  const [comMembro] = await db.select({ id: schema.tenantMemberships.id }).from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.customRoleId, role.id))).limit(1);
  if (comMembro) throw new Error("Tire o cargo das pessoas antes de arquivar: arquivar ampliaria o acesso delas.");
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
  if (!member || member.userId === context.userId) throw new Error("Este acesso não pode ter o cargo alterado.");
  if (customRoleId) {
    await assertCargoAssignable({ actor: context, membershipId: member.id, role: member.role, jobTitle: member.jobTitle, customRoleId });
  }
  await db.update(schema.tenantMemberships).set({ customRoleId, updatedAt: new Date() }).where(eq(schema.tenantMemberships.id, member.id));
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "tenant_membership", entidadeId: member.id, acao: customRoleId ? "custom_role.assigned" : "custom_role.removed" });
}

/**
 * Regras para pôr um cargo em alguém (04/11), usadas na tela de cargos, na edição do membro e no convite:
 * só diretor sem cargo atribui; o cargo precisa estar ativo e ser da empresa; nenhuma permissão do cargo
 * pode faltar ao papel da pessoa (o cargo só corta); diretor com cargo é permitido desde que sobre outro
 * diretor ativo sem cargo.
 */
export async function assertCargoAssignable(input: {
  actor: { tenantId: string; role: string; customRoleId?: string | null };
  membershipId: string | null;
  role: TenantRole;
  jobTitle: string;
  customRoleId: string;
}) {
  if (input.actor.role !== "director" || input.actor.customRoleId) throw new Error("Somente o Diretor pode definir cargos.");
  // Até a F2 (ações internas das telas respeitando o cargo), o cargo só esconderia menu e páginas, sem
  // proteger os dados: atribuir fica fechado para não dar falsa segurança (revisão do Vigia, 04/11).
  if (!CARGO_PROTEGE_ACOES) throw new Error("A atribuição de cargos volta quando as telas internas respeitarem o cargo.");
  const db = getDatabase();
  const [role] = await db.select({ id: schema.customRoles.id, scope: schema.customRoles.scope }).from(schema.customRoles).where(and(eq(schema.customRoles.id, input.customRoleId), eq(schema.customRoles.tenantId, input.actor.tenantId), eq(schema.customRoles.status, "active"))).limit(1);
  if (!role) throw new Error("Escolha um cargo ativo da própria empresa.");
  const grants = await db.select({ key: schema.customRolePermissions.permissionKey }).from(schema.customRolePermissions).where(eq(schema.customRolePermissions.customRoleId, role.id));
  // Rota conta pelo piso dela: um cargo não pode abrir uma tela que o papel não abre.
  const foraDoPapel = grants.map((grant) => grant.key).filter((key) => {
    if (!isRoutePermission(key)) return !hasCapability(input.role, key as PermissionKey, input.jobTitle);
    const rota = (routeCatalog as readonly RouteDefinition[]).find((route) => routePermissionKey(route.key) === key);
    return !rota || !hasCapability(input.role, rota.fallbackPermission, input.jobTitle);
  });
  if (foraDoPapel.length) throw new Error(`O papel desta pessoa não tem: ${foraDoPapel.join(", ")}. Ajuste o cargo ou o papel.`);
  // Dentro dessas telas as ações ainda checam o papel, não o cargo: o cargo leva a área inteira ou não leva
  // a tela (revisão do Vigia, 04/11). Ao cobrir as ações com requireCargoCapability, sai da lista.
  const chaves = new Set(grants.map((grant) => grant.key));
  const cortesSemTrava = Object.entries(AREAS_SEM_CORTE_FINO).flatMap(([rotaKey, permissoes]) =>
    chaves.has(routePermissionKey(rotaKey))
      ? permissoes.filter((permission) => hasCapability(input.role, permission, input.jobTitle) && !chaves.has(permission))
      : [],
  );
  if (cortesSemTrava.length) throw new Error(`Nesta tela o cargo ainda precisa levar também: ${cortesSemTrava.join(", ")}.`);
  if (input.role === "director") {
    const [livre] = await db.select({ id: schema.tenantMemberships.id }).from(schema.tenantMemberships).where(and(
      eq(schema.tenantMemberships.tenantId, input.actor.tenantId),
      eq(schema.tenantMemberships.role, "director"),
      eq(schema.tenantMemberships.status, "active"),
      isNull(schema.tenantMemberships.customRoleId),
      ...(input.membershipId ? [ne(schema.tenantMemberships.id, input.membershipId)] : []),
    )).limit(1);
    if (!livre) throw new Error("A empresa precisa de pelo menos um diretor sem cargo.");
  }
  return role;
}
