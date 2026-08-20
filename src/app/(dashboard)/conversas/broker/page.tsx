import { redirect } from "next/navigation";
import { desc, eq, and, isNull } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { LightConversationsView } from "@/features/broker-workspace/components/light-conversations-view";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { samePhone } from "@/features/communication-channels/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasPermission } from "@/shared/auth/permissions";

// Não gerar estaticamente — a página depende de sessão
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rota do corretor (modo lite) — usa WAHA para WhatsApp.
 * Apenas corretores podem acessar. Diretores/gestores vão para /conversas.
 */
export default async function BrokerConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string }>;
}) {
  const { leadId } = await searchParams;
  const context = await getRequiredTenantContext();

  if (!hasPermission(context.role, "acessar_conversas")) {
    redirect("/minha-fila");
  }

  // Se não for corretor, redirecionar para /conversas (modo normal)
  const isBroker = context.role === "broker" || context.jobTitle === "broker";
  if (!isBroker) {
    redirect("/conversas");
  }

  const db = getDatabase();

  // ── Buscar leads do corretor ──────────────────────────────────────────
  const lightLeads = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      createdAt: schema.leads.createdAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
        eq(schema.leads.corretorId, context.userId),
      ),
    )
    .orderBy(desc(schema.leads.stageEnteredAt))
    .limit(100);

  const leadIds = lightLeads.map((l) => l.id);

  // ── Buscar mensagens ──────────────────────────────────────────────────
  const messageRows = leadIds.length
    ? await db
        .select({
          id: schema.whatsappMessages.id,
          leadId: schema.whatsappMessages.leadId,
          phone: schema.whatsappMessages.phone,
          body: schema.whatsappMessages.body,
          direction: schema.whatsappMessages.direction,
          senderRole: schema.whatsappMessages.senderRole,
          providerStatus: schema.whatsappMessages.providerStatus,
          sentAt: schema.whatsappMessages.sentAt,
        })
        .from(schema.whatsappMessages)
        .where(eq(schema.whatsappMessages.tenantId, context.tenantId))
        .orderBy(desc(schema.whatsappMessages.sentAt))
        .limit(500)
    : [];

  const messagesByLead = new Map<string, typeof messageRows>();
  for (const msg of messageRows) {
    const matched = lightLeads.find(
      (l) =>
        l.id === msg.leadId ||
        (Boolean(msg.phone && l.telefone) && samePhone(msg.phone, l.telefone)),
    );
    if (matched) {
      const list = messagesByLead.get(matched.id) ?? [];
      list.push(msg);
      messagesByLead.set(matched.id, list);
    }
  }

  // ── Montar conversas ──────────────────────────────────────────────────
  const conversations = lightLeads.map((lead) => {
    const msgs = (messagesByLead.get(lead.id) ?? [])
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .slice(-100);
    const latest = msgs.at(-1) ?? null;
    return {
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      status: lead.status,
      latestMessage: latest
        ? {
            body: latest.body,
            direction: latest.direction,
            sentAt: latest.sentAt.toISOString(),
          }
        : null,
      messages: msgs.map((m) => ({
        id: m.id,
        body: m.body,
        direction: m.direction,
        sentAt: m.sentAt.toISOString(),
        senderRole: m.senderRole,
        providerStatus: m.providerStatus,
      })),
    };
  });

  // Sort: conversas com mensagens recentes primeiro
  conversations.sort((a, b) => {
    const timeA = a.latestMessage
      ? new Date(a.latestMessage.sentAt).getTime()
      : 0;
    const timeB = b.latestMessage
      ? new Date(b.latestMessage.sentAt).getTime()
      : 0;
    return timeB - timeA;
  });

  // ── Status WhatsApp do corretor ───────────────────────────────────────
  const [conn] = await db
    .select({
      sessionName: schema.whatsappConnections.sessionName,
      status: schema.whatsappConnections.status,
      chatInternoAtivo: schema.whatsappConnections.chatInternoAtivo,
    })
    .from(schema.whatsappConnections)
    .where(
      and(
        eq(schema.whatsappConnections.tenantId, context.tenantId),
        eq(schema.whatsappConnections.userId, context.userId),
      ),
    )
    .limit(1);

  const whatsappConnected =
    conn?.status === "ready" && conn?.chatInternoAtivo === true;

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Conversas" />
      <main className="min-h-0 w-full flex-1 bg-background p-0">
        <div className="h-full min-h-[calc(100dvh-var(--header-height,3.5rem))] max-[559px]:min-h-0 w-full overflow-hidden bg-card">
          <LightConversationsView
            conversations={conversations}
            initialLeadId={leadId}
            whatsappConnected={whatsappConnected}
          />
        </div>
      </main>
    </>
  );
}
