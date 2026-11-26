import { isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { and, eq, ilike, isNull, or, isNotNull } from "drizzle-orm";
import { inSupervisorTeam, isSupervisorTeamScoped } from "@/features/team/supervisor-scope";
import { NextRequest } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import type { TenantRole } from "@/shared/db/schema";

import { visibleToManagement } from "@/features/supervisor-workspace/lead-import/team-list-sql";

function leadScope(tenantId: string, role: TenantRole, branchId: string | null, userId: string, teamScoped = false) {
  const base = and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt));
  // Lista interna da equipe (16/11): a gestão só acha o lead depois que o cliente respondeu.
  if (role === "director") return and(base, visibleToManagement());
  if (teamScoped) return and(base, inSupervisorTeam(schema.leads.corretorId, tenantId, userId));
  if ((role === "manager" || role === "supervisor") && branchId) {
    return and(base, eq(schema.leads.branchId, branchId), role === "manager" ? visibleToManagement() : undefined);
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

  // Páginas e funcionalidades vêm do cadastro do menu, no próprio Ctrl+K (lote 2, 26/11/2026). Aqui só dados do CRM.
  // A manager without an authenticated unit has no operational search scope.
  if (context.role === "manager" && !context.branchId) return Response.json({ enabled: true, groups: [] });

  const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`.trim();
  const teamScoped = isSupervisorTeamScoped(context);
  const scope = leadScope(context.tenantId, context.role, context.branchId, context.userId, teamScoped);
  const [leads, clients, tasks, team] = await Promise.all([
    db.select({ id: schema.leads.id, title: schema.leads.nome, subtitle: schema.leads.email, status: schema.leads.status })
      .from(schema.leads)
      .where(and(scope, or(ilike(schema.leads.nome, pattern), ilike(schema.leads.telefone, pattern), ilike(schema.leads.email, pattern))))
      .limit(6),
    isOutsideManagerScope(context.role, context.jobTitle) ? Promise.resolve([]) : db.select({ id: schema.clients.id, title: schema.clients.nome, subtitle: schema.clients.email, leadId: schema.clients.leadId })
      .from(schema.clients)
      .where(and(eq(schema.clients.tenantId, context.tenantId), isNotNull(schema.clients.leadId) /* DEC-187: só clientes de venda */, ...(context.role === "manager" && context.branchId ? [eq(schema.clients.branchId, context.branchId)] : []), ...(context.role === "broker" ? [eq(schema.clients.corretorId, context.userId)] : []), ...(teamScoped ? [inSupervisorTeam(schema.clients.corretorId, context.tenantId, context.userId)] : []), or(ilike(schema.clients.nome, pattern), ilike(schema.clients.telefone, pattern), ilike(schema.clients.email, pattern))))
      .limit(6),
    isOutsideManagerScope(context.role, context.jobTitle) ? Promise.resolve([]) : db.select({ id: schema.leadTasks.id, title: schema.leadTasks.title, subtitle: schema.leads.nome, leadId: schema.leadTasks.leadId })
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
      { type: "leads", label: "Leads", items: leads.map((item) => ({ ...item, href: `/leads/${item.id}` })) },
      { type: "clients", label: "Clientes", items: clients.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, href: `/clientes/${item.id}` })) },
      { type: "tasks", label: "Tarefas", items: tasks.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, href: `/leads/${item.leadId}#tarefas` })) },
      // Corretor só acha a si mesmo; a ficha de pessoa é de quem gere equipe.
      { type: "team", label: "Equipe", items: context.role === "broker" ? [] : team.map((item) => ({ ...item, href: `/equipe/${item.id}` })) },
    ].filter((group) => group.items.length),
  });
}
