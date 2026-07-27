import { and, eq, ilike, or } from "drizzle-orm";
import { NextRequest } from "next/server";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

function leadScope(tenantId: string, role: "director" | "manager" | "broker", branchId: string | null, userId: string) {
  const conditions = [eq(schema.leads.tenantId, tenantId)];
  if (role === "manager" && branchId) conditions.push(eq(schema.leads.branchId, branchId));
  if (role === "broker") conditions.push(eq(schema.leads.corretorId, userId));
  return and(...conditions);
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json({ enabled: true, groups: [] });
  if (query.length > 80) return Response.json({ error: "Busca muito longa." }, { status: 400 });

  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const feature = await getSystemSetting("feature_global_search_enabled");
  if (feature === "false") return Response.json({ enabled: false, groups: [] });

  const pattern = `%${query.replace(/[%_]/g, "\\$&")} %`.trim();
  const scope = leadScope(context.tenantId, context.role, context.branchId, context.userId);
  const [leads, clients, tasks, team] = await Promise.all([
    db.select({ id: schema.leads.id, title: schema.leads.nome, subtitle: schema.leads.email, status: schema.leads.status })
      .from(schema.leads)
      .where(and(scope, or(ilike(schema.leads.nome, pattern), ilike(schema.leads.telefone, pattern), ilike(schema.leads.email, pattern))))
      .limit(8),
    db.select({ id: schema.clients.id, title: schema.clients.nome, subtitle: schema.clients.email, leadId: schema.clients.leadId })
      .from(schema.clients)
      .where(and(eq(schema.clients.tenantId, context.tenantId), ...(context.role === "manager" && context.branchId ? [eq(schema.clients.branchId, context.branchId)] : []), ...(context.role === "broker" ? [eq(schema.clients.corretorId, context.userId)] : []), or(ilike(schema.clients.nome, pattern), ilike(schema.clients.telefone, pattern), ilike(schema.clients.email, pattern))))
      .limit(8),
    db.select({ id: schema.leadTasks.id, title: schema.leadTasks.title, subtitle: schema.leads.nome, leadId: schema.leadTasks.leadId })
      .from(schema.leadTasks)
      .innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id))
      .where(and(eq(schema.leadTasks.tenantId, context.tenantId), scope, or(ilike(schema.leadTasks.title, pattern), ilike(schema.leadTasks.description, pattern), ilike(schema.leads.nome, pattern))))
      .limit(8),
    db.select({ id: schema.user.id, title: schema.user.name, subtitle: schema.user.email })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.status, "active"), ...(context.role === "manager" && context.branchId ? [eq(schema.tenantMemberships.branchId, context.branchId)] : []), ...(context.role === "broker" ? [eq(schema.tenantMemberships.userId, context.userId)] : []), or(ilike(schema.user.name, pattern), ilike(schema.user.email, pattern))))
      .limit(8),
  ]);

  return Response.json({
    enabled: true,
    groups: [
      { type: "leads", label: "Leads", items: leads.map((item) => ({ ...item, href: `/leads/${item.id}` })) },
      { type: "clients", label: "Clientes", items: clients.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, href: `/clientes?leadId=${item.leadId}` })) },
      { type: "tasks", label: "Tarefas", items: tasks.map((item) => ({ id: item.id, title: item.title, subtitle: item.subtitle, href: `/leads/${item.leadId}#tarefas` })) },
      { type: "team", label: "Equipe", items: team.map((item) => ({ ...item, href: "/equipe" })) },
    ].filter((group) => group.items.length),
  });
}
