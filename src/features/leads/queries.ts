import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { assertTenantAccess } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export async function getLeadTimeline(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [lead] = await db
    .select({
      id: schema.leads.id,
      tenantId: schema.leads.tenantId,
      corretorId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);

  if (!lead) return null;
  assertTenantAccess(context, lead.tenantId);

  if (context.role === "broker" && lead.corretorId !== context.userId) return null;
  if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) return null;

  return db
    .select({
      id: schema.leadInteractions.id,
      tipo: schema.leadInteractions.tipo,
      conteudo: schema.leadInteractions.conteudo,
      metadata: schema.leadInteractions.metadata,
      userId: schema.leadInteractions.userId,
      createdAt: schema.leadInteractions.createdAt,
      userName: schema.user.name,
    })
    .from(schema.leadInteractions)
    .leftJoin(schema.user, eq(schema.leadInteractions.userId, schema.user.id))
    .where(eq(schema.leadInteractions.leadId, leadId))
    .orderBy(desc(schema.leadInteractions.createdAt));
}

export async function getUrgentLeadForUser() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  if (context.role === "broker") {
    // 1. First check for assigned leads that are awaiting first contact
    const [uncontacted] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        status: schema.leads.status,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, context.userId),
          eq(schema.leads.status, "distributed"),
        ),
      )
      .orderBy(schema.leads.assignedAt)
      .limit(1);

    if (uncontacted) {
      return { ...uncontacted, urgentReason: "Aguardando 1º contato" };
    }

    // 2. Next check for active assigned leads in contact / negotiation
    const [active] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        status: schema.leads.status,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, context.userId),
          and(
            eq(schema.leads.tenantId, context.tenantId),
            eq(schema.leads.corretorId, context.userId),
          ),
        ),
      )
      .orderBy(schema.leads.updatedAt)
      .limit(1);

    if (active && active.status !== "converted" && active.status !== "lost") {
      return { ...active, urgentReason: "Atendimento em andamento" };
    }

    return null;
  }

  // For manager or director: find lead waiting distribution or SLA attention
  const [urgentManagerLead] = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      status: schema.leads.status,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        ...(context.role === "manager" && context.branchId ? [eq(schema.leads.branchId, context.branchId)] : []),
      ),
    )
    .orderBy(desc(schema.leads.createdAt))
    .limit(1);

  if (urgentManagerLead && urgentManagerLead.status !== "converted" && urgentManagerLead.status !== "lost") {
    return { ...urgentManagerLead, urgentReason: "Requer atenção na fila" };
  }

  return null;
}

