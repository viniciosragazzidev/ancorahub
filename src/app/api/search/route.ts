import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { inSupervisorTeam, isSupervisorTeamScoped } from "@/features/team/supervisor-scope";
import { NextRequest } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getUserDisplayInfo } from "@/shared/auth/actions";
import { canShowNavigationItem } from "@/shared/navigation-access";
import { FEATURE_FLAGS, getFeatureFlag, getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import type { TenantRole } from "@/shared/db/schema";

import { FEATURE_SEARCH_INDEX } from "@/shared/feature-search-index";

function leadScope(tenantId: string, role: TenantRole, branchId: string | null, userId: string, teamScoped = false) {
  const base = and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt));
  if (role === "director") return base;
  if (teamScoped) return and(base, inSupervisorTeam(schema.leads.corretorId, tenantId, userId));
  if ((role === "manager" || role === "supervisor") && branchId) {
    return and(base, eq(schema.leads.branchId, branchId));
  }
  return and(base, eq(schema.leads.corretorId, userId));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ enabled: true, groups: [] });
  if (query.length > 80) return Response.json({ error: "Busca muito longa." }, { status: 400 });

  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const feature = await getSystemSetting("feature_global_search_enabled");
  if (feature === "false") return Response.json({ enabled: false, groups: [] });

  const displayUser = await getUserDisplayInfo();
  const qLower = query.toLowerCase();
  const matchingFeatures = FEATURE_SEARCH_INDEX.filter((feat) => {
    const matchesQuery = (
      feat.title.toLowerCase().includes(qLower) ||
      feat.description.toLowerCase().includes(qLower) ||
      feat.keywords.some((k) => k.toLowerCase().includes(qLower))
    );
    return matchesQuery && canShowNavigationItem(feat, displayUser);
  }).slice(0, 6);

  // A manager without an authenticated unit has no operational search scope.
  const managerLiteEnabled = context.role === "manager" && (await getFeatureFlag(FEATURE_FLAGS.MANAGER_LITE).catch(() => "false")) === "true";
  if (managerLiteEnabled && !context.branchId) {
    return Response.json({ enabled: true, groups: matchingFeatures.length ? [{
      type: "features", label: "Funcionalidades & Módulos", items: matchingFeatures.map((feature) => ({
        id: feature.id, title: feature.title, subtitle: `${feature.domain} · ${feature.description}`, href: feature.url,
      })),
    }] : [] });
  }

  const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`.trim();
  const teamScoped = isSupervisorTeamScoped(context);
  const scope = leadScope(context.tenantId, context.role, context.branchId, context.userId, teamScoped);
  const [leads, clients, tasks, team] = await Promise.all([
    db.select({ id: schema.leads.id, title: schema.leads.nome, subtitle: schema.leads.email, status: schema.leads.status })
      .from(schema.leads)
      .where(and(scope, or(ilike(schema.leads.nome, pattern), ilike(schema.leads.telefone, pattern), ilike(schema.leads.email, pattern))))
      .limit(6),
    db.select({ id: schema.clients.id, title: schema.clients.nome, subtitle: schema.clients.email, leadId: schema.clients.leadId })
      .from(schema.clients)
      .where(and(eq(schema.clients.tenantId, context.tenantId), ...(context.role === "manager" && context.branchId ? [eq(schema.clients.branchId, context.branchId)] : []), ...(context.role === "broker" ? [eq(schema.clients.corretorId, context.userId)] : []), ...(teamScoped ? [inSupervisorTeam(schema.clients.corretorId, context.tenantId, context.userId)] : []), or(ilike(schema.clients.nome, pattern), ilike(schema.clients.telefone, pattern), ilike(schema.clients.email, pattern))))
      .limit(6),
    db.select({ id: schema.leadTasks.id, title: schema.leadTasks.title, subtitle: schema.leads.nome, leadId: schema.leadTasks.leadId })
      .from(schema.leadTasks)
      .innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id))
      .where(and(eq(schema.leadTasks.tenantId, context.tenantId), scope, or(ilike(schema.leadTasks.title, pattern), ilike(schema.leadTasks.description, pattern), ilike(schema.leads.nome, pattern))))
      .limit(6),
    db.select({ id: schema.user.id, title: schema.user.name, subtitle: schema.user.email })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.status, "active"), ...(context.role === "manager" && context.branchId ? [eq(schema.tenantMemberships.branchId, context.branchId)] : []), ...(context.role === "broker" ? [eq(schema.tenantMemberships.userId, context.userId)] : []), ...(teamScoped ? [eq(schema.tenantMemberships.supervisorId, context.userId)] : []), or(ilike(schema.user.name, pattern), ilike(schema.user.email, pattern))))
      .limit(6),
  ]);

  return Response.json({
    enabled: true,
    groups: [
      {
        type: "features",
        label: "Funcionalidades & Módulos",
        items: matchingFeatures.map((f) => ({
          id: f.id,
          title: f.title,
          subtitle: `${f.domain} · ${f.description}`,
          href: f.url,
        })),
      },
      { type: "leads", label: "Leads", items: leads.map((item) => ({ ...item, href: `/leads/${item.id}` })) },
      { type: "clients", label: "Clientes", items: clients.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, href: `/clientes?leadId=${item.leadId}` })) },
      { type: "tasks", label: "Tarefas", items: tasks.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, href: `/leads/${item.leadId}#tarefas` })) },
      { type: "team", label: "Equipe", items: team.map((item) => ({ ...item, href: "/equipe" })) },
    ].filter((group) => group.items.length),
  });
}
