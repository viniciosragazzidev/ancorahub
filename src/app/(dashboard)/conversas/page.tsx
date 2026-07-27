import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { ConversationsWorkspace, type ConversationItem, type ConversationMessage } from "./conversations-workspace";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// Não gerar estaticamente — a página depende de sessão e executa queries pesadas de AI
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const isDirector = context.role === "director";
  const scope = context.role === "broker"
    ? eq(schema.leads.corretorId, context.userId)
    : context.role === "manager" && context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : undefined;

  const [leads, branches] = await Promise.all([
    db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        email: schema.leads.email,
        status: schema.leads.status,
        origem: schema.leads.origem,
        branchId: schema.leads.branchId,
        corretorId: schema.leads.corretorId,
        corretorNome: schema.user.name,
        branchName: schema.branches.name,
        consentimentoLgpd: schema.leads.consentimentoLgpd,
        createdAt: schema.leads.createdAt,
        stageEnteredAt: schema.leads.stageEnteredAt,
        planName: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .leftJoin(schema.carrierPlans, eq(schema.leads.planId, schema.carrierPlans.id))
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNotNull(schema.leads.serviceStartedAt), ...(scope ? [scope] : [])))
      .orderBy(desc(schema.leads.stageEnteredAt))
      .limit(100),
    isDirector
      ? db
          .select({ id: schema.branches.id, name: schema.branches.name })
          .from(schema.branches)
          .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
          .orderBy(asc(schema.branches.name))
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const leadIds = leads.map((lead) => lead.id);

  const messagesSubquery = leadIds.length
    ? db
        .select({
          id: schema.whatsappMessages.id,
          leadId: schema.whatsappMessages.leadId,
          body: schema.whatsappMessages.body,
          direction: schema.whatsappMessages.direction,
          sentAt: schema.whatsappMessages.sentAt,
          rn: sql<number>`row_number() over (partition by ${schema.whatsappMessages.leadId} order by ${schema.whatsappMessages.sentAt} desc)`.as("rn")
        })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.tenantId, context.tenantId),
            inArray(schema.whatsappMessages.leadId, leadIds)
          )
        )
        .as("msg_sq")
    : null;

  const [messageRows, documentRows, aiConversationRows] = leadIds.length && messagesSubquery
    ? await Promise.all([
      db
        .select({
          id: messagesSubquery.id,
          leadId: messagesSubquery.leadId,
          body: messagesSubquery.body,
          direction: messagesSubquery.direction,
          sentAt: messagesSubquery.sentAt
        })
        .from(messagesSubquery)
        .where(lt(messagesSubquery.rn, 21))
        .orderBy(messagesSubquery.sentAt),
      db
        .select({ id: schema.leadDocuments.id, leadId: schema.leadDocuments.leadId, filename: schema.leadDocuments.filename, fileUrl: schema.leadDocuments.fileUrl, status: schema.leadDocuments.status, requirementName: schema.documentRequirements.name, createdAt: schema.leadDocuments.createdAt })
        .from(schema.leadDocuments)
        .leftJoin(schema.documentRequirements, eq(schema.leadDocuments.requirementId, schema.documentRequirements.id))
        .where(and(eq(schema.leadDocuments.tenantId, context.tenantId), inArray(schema.leadDocuments.leadId, leadIds)))
        .orderBy(desc(schema.leadDocuments.createdAt)),
      db
        .select({
          id: schema.aiConversations.id,
          leadId: schema.aiConversations.leadId,
          status: schema.aiConversations.status,
          aiModel: schema.aiConversations.aiModel,
          transferReason: schema.aiConversations.transferReason,
          qualificationSummary: schema.aiConversations.qualificationSummary,
          assignedUserId: schema.aiConversations.assignedUserId,
        })
        .from(schema.aiConversations)
        .where(and(eq(schema.aiConversations.tenantId, context.tenantId), inArray(schema.aiConversations.leadId, leadIds)))
        .catch(() => []),
    ])
    : [[], [], []] as const;

  const messagesByLead = new Map<string, ConversationMessage[]>();
  for (const message of messageRows) {
    if (!message.leadId) continue;
    const items = messagesByLead.get(message.leadId) ?? [];
    items.push({ ...message, sentAt: message.sentAt.toISOString() });
    messagesByLead.set(message.leadId, items);
  }

  const documentsByLead = new Map<string, { id: string; filename: string; fileUrl: string; status: string; requirementName: string | null; createdAt: string }[]>();
  for (const document of documentRows) {
    const items = documentsByLead.get(document.leadId) ?? [];
    items.push({ ...document, createdAt: document.createdAt.toISOString() });
    documentsByLead.set(document.leadId, items);
  }

  const aiConversationsByLead = new Map<string, typeof aiConversationRows[number]>();
  for (const aiConv of aiConversationRows) {
    if (aiConv.leadId) {
      aiConversationsByLead.set(aiConv.leadId, aiConv);
    }
  }

  const conversations: ConversationItem[] = leads.map((lead) => {
    const messages = messagesByLead.get(lead.id) ?? [];
    const latest = messages.at(-1) ?? null;
    const aiConv = aiConversationsByLead.get(lead.id) ?? null;
    return {
      ...lead,
      createdAt: lead.createdAt.toISOString(),
      stageEnteredAt: lead.stageEnteredAt.toISOString(),
      latestMessage: latest ? { body: latest.body, direction: latest.direction, sentAt: latest.sentAt } : null,
      messages,
      documents: documentsByLead.get(lead.id) ?? [],
      aiConversation: aiConv
        ? {
            id: aiConv.id,
            status: aiConv.status as any,
            aiModel: aiConv.aiModel,
            transferReason: aiConv.transferReason,
            qualificationSummary: aiConv.qualificationSummary,
            assignedUserId: aiConv.assignedUserId,
          }
        : null,
    };
  });

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Conversas" />
      <main className="min-w-0 min-h-0 flex-1 bg-background p-3 lg:p-4">
        <ConversationsWorkspace
          role={context.role}
          branches={branches}
          conversations={conversations}
          initialLeadId={leadId}
          userId={context.userId}
          tenantId={context.tenantId}
        />
      </main>
    </>
  );
}
