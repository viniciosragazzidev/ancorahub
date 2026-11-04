import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { AuthorizationError } from "./errors";
import { getRequiredSession } from "./session";
import type { TenantContext } from "./types";
import { requiresMemberBranch } from "@/features/custom-roles/member-scope";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getSuperAdminRoleOverride } from "@/features/super-admin/role-impersonation";
import { isActivePlatformAdmin, readViewAsTargetId, VIEW_AS_ROLES } from "@/features/super-admin/view-as";
import { selectSingleActiveMembership } from "./active-membership";
import {
  markTenantStart,
  markTenantEnd,
  markDbStart,
  markDbEnd,
  withTimeout,
  getRequestTiming,
  withPerfSpan,
} from "@/shared/observability/request-timing";

export type { TenantContext };

/** Arquivo de origem de cada ação, lido do manifesto do build (uma vez por processo). */
let manifestoAcoes: Map<string, string> | null = null;
async function arquivoDaAcao(actionId: string): Promise<string | null> {
  if (!manifestoAcoes) {
    try {
      const [{ readFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
      const bruto = JSON.parse(await readFile(path.join(process.cwd(), ".next", "server", "server-reference-manifest.json"), "utf8")) as {
        node?: Record<string, { filename?: string }>;
      };
      manifestoAcoes = new Map(Object.entries(bruto.node ?? {}).flatMap(([id, item]) => (item.filename ? [[id, item.filename]] : [])));
    } catch {
      return null; // sem manifesto: quem tem cargo fica negado (fail closed)
    }
  }
  return manifestoAcoes.get(actionId) ?? null;
}

/**
 * Cargos (04/11, F2): ação de servidor de quem tem cargo só roda se a ÁREA do arquivo da ação estiver
 * liberada (action-areas.ts). A fronteira é o arquivo da ação, não a URL que o cliente manda.
 */
async function assertCargoActionRoute(input: { tenantId: string; role: TenantContext["role"]; jobTitle: string; customRoleId: string }) {
  let actionId = "";
  try {
    actionId = (await headers()).get("next-action") ?? "";
  } catch {
    return; // fora de um request (scripts, jobs)
  }
  if (!actionId) return; // página (GET) e /api: o layout e cada rota decidem
  const [{ getEffectiveAccess }, { canAccessRoute }, { routeCatalog }, { requisitoDaAcao }] = await Promise.all([
    import("@/features/custom-roles/service"),
    import("@/features/custom-roles/effective-access"),
    import("@/features/custom-roles/routes"),
    import("@/features/custom-roles/action-areas"),
  ]);
  const requisito = requisitoDaAcao(await arquivoDaAcao(actionId));
  if (requisito.kind === "livre") return;
  const access = await getEffectiveAccess(input);
  const liberado = requisito.kind === "cap"
    ? access.capabilities.has(requisito.permission)
    : requisito.kind === "route"
      ? canAccessRoute(access, routeCatalog.find((route) => route.key === requisito.key))
      : false;
  if (!liberado) throw new AuthorizationError("Seu cargo não libera esta ação.");
}

const TENANT_QUERY_TIMEOUT_MS = 5_000;

/**
 * The user's memberships (role, unit, status) were re-read on every request.
 * Kept for 20s per user in this process: a role/unit change or a deactivation
 * applies within 20s; membership writers can call invalidateTenantContextCache.
 */
const MEMBERSHIP_CACHE_TTL_MS = 20_000;

function loadMemberships(userId: string) {
  return getDatabase()
    .select({
      userActive: schema.user.active,
      isPlatformAdmin: schema.user.isPlatformAdmin,
      tenantId: schema.tenants.id,
      tenantStatus: schema.tenants.status,
      membershipStatus: schema.tenantMemberships.status,
      role: schema.tenantMemberships.role,
      jobTitle: schema.tenantMemberships.jobTitle,
      customRoleId: schema.tenantMemberships.customRoleId,
      customRoleScope: schema.customRoles.scope,
      branchId: schema.tenantMemberships.branchId,
      branchStatus: schema.branches.status,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .innerJoin(schema.tenants, eq(schema.tenantMemberships.tenantId, schema.tenants.id))
    .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
    .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
    .where(eq(schema.tenantMemberships.userId, userId));
}

const membershipCache = new TtlCache<Awaited<ReturnType<typeof loadMemberships>>>(MEMBERSHIP_CACHE_TTL_MS, 2000);

export function invalidateTenantContextCache(userId?: string) {
  if (userId) membershipCache.delete(userId);
  else membershipCache.clear();
}

async function resolveRequiredTenantContext(): Promise<TenantContext> {
  // Session phase is already timed by getRequiredSession()
  const { user: sessionUser } = await getRequiredSession();

  // "Ver como": only an active platform admin can see the app as a broker or a supervisor.
  const viewAsTarget = await readViewAsTargetId();
  const viewAs = viewAsTarget && viewAsTarget !== sessionUser.id && (await isActivePlatformAdmin(sessionUser.id))
    ? { adminUserId: sessionUser.id }
    : null;
  const effectiveUserId = viewAs && viewAsTarget ? viewAsTarget : sessionUser.id;

  markTenantStart();
  markDbStart();

  try {
    const memberships = await membershipCache.getOrLoad(effectiveUserId, () => withPerfSpan("tenant.resolve", () => withTimeout(
      loadMemberships(effectiveUserId),
      TENANT_QUERY_TIMEOUT_MS,
      "getRequiredTenantContext",
    )));

    markDbEnd();
    markTenantEnd();

    const membership = selectSingleActiveMembership(memberships);

    if (!membership.userActive) {
      throw new AuthorizationError("The authenticated user is inactive.");
    }

    if (viewAs && !(VIEW_AS_ROLES as readonly string[]).includes(membership.role)) {
      throw new AuthorizationError("Ver como só vale para corretor ou supervisor.");
    }

    if (membership.tenantStatus !== "active") {
      throw new AuthorizationError("The tenant is not active.");
    }

    if (
      requiresMemberBranch({
        jobTitle: membership.jobTitle,
        customRoleScope: membership.customRoleScope,
      }) &&
      !membership.branchId
    ) {
      throw new AuthorizationError(
        "O acesso operacional precisa estar vinculado a uma unidade.",
      );
    }

    if (membership.branchId && membership.branchStatus !== "active") {
      throw new AuthorizationError("The associated branch is not active.");
    }

    // Cargos (04/11, F2): ação de servidor de quem tem cargo só roda se a área da ação estiver liberada.
    if (membership.customRoleId) {
      await assertCargoActionRoute({
        tenantId: membership.tenantId,
        role: membership.role,
        jobTitle: membership.jobTitle,
        customRoleId: membership.customRoleId,
      });
    }

    return {
      userId: effectiveUserId,
      tenantId: membership.tenantId,
      role: membership.role,
      jobTitle: membership.jobTitle,
      customRoleId: membership.customRoleId,
      customRoleScope: membership.customRoleScope,
      branchId: membership.branchId,
      ...(membership.role === "supervisor"
        ? { supervisorTeamScope: (await getFeatureFlag(FEATURE_FLAGS.SUPERVISOR_TEAM_SCOPE).catch(() => "false")) === "true" }
        : {}),
      ...(viewAs ? { viewAs } : {}),
    };
  } catch (error) {
    markDbEnd();
    markTenantEnd();

    const timing = getRequestTiming();
    const requestId = timing?.requestId ?? "unknown";
    const isTimeout =
      error instanceof Error && error.message.startsWith("TIMEOUT:");

    if (isTimeout) {
      console.error(
        JSON.stringify({
          type: "tenant_timeout",
          requestId,
          timeoutMs: TENANT_QUERY_TIMEOUT_MS,
        }),
      );
      throw new AuthorizationError(
        "A resolução de contexto está demorando mais que o esperado. Tente novamente.",
        "TENANT_TIMEOUT",
      );
    }

    // Re-throw AuthorizationError as-is
    if (error instanceof AuthorizationError) {
      throw error;
    }

    // Unexpected error
    console.error(
      JSON.stringify({
        type: "tenant_error",
        requestId,
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    throw error;
  }
}

/**
 * Request-scoped only: a layout and its page share one authoritative tenant
 * lookup, while every new request still rechecks membership and permissions.
 */
export const getRequiredTenantContext = cache(resolveRequiredTenantContext);
