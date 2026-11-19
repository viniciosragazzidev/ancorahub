import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { liteStageLabel } from "@/app/(dashboard)/leads/lite-stage-labels";
import { aiSaleRegistrationPending } from "@/features/conversation-intelligence/sale-detection-core";
import { isBrokerQuickSaleEnabled } from "@/features/broker-workspace/quick-sale-flag";
import { SaleChatBlocked, SaleChatPage } from "@/features/post-sale/components/sale-chat-page";
import { loadSaleCatalog, loadSaleChatLead } from "@/features/post-sale/conversation-sale-queries";
import { saleRegistrationBlockedReason } from "@/features/post-sale/sale-registration-v2-core";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]![0] : "")).toUpperCase() || "?";
}

/**
 * Registrar venda em conversa (19/11): depois de escolher o cliente, o corretor responde ou manda o contrato e
 * confirma. Só o corretor responsável pelo lead; sem documentos nesta fase.
 */
export default async function RegisterSaleConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") redirect(`/leads/${encodeURIComponent(id)}`);
  if (!(await isBrokerQuickSaleEnabled())) {
    return <SaleChatBlocked leadId={id} title="Registrar venda está em pausa." text="Por enquanto, registre pela tela do lead." />;
  }

  const lead = await loadSaleChatLead(context, id);
  if (!lead) return <SaleChatBlocked leadId={null} title="Esse lead não está com você." text="Só o corretor responsável registra a venda." />;
  if (lead.status === "new" || lead.status === "distributed") {
    return <SaleChatBlocked leadId={lead.id} title="Aceite o lead antes de registrar a venda." text="Depois do aceite, volte aqui." />;
  }
  const [activeSale] = await getDatabase().select({ id: schema.sales.id }).from(schema.sales)
    .where(and(eq(schema.sales.leadId, lead.id), eq(schema.sales.tenantId, context.tenantId), eq(schema.sales.status, "active"))).limit(1);
  const block = saleRegistrationBlockedReason({ status: lead.status, aiRegistrationPending: aiSaleRegistrationPending(lead.status, lead.qualificationDetails), hasActiveSale: Boolean(activeSale) });
  if (block === "lost") return <SaleChatBlocked leadId={lead.id} title="Este lead está como perdido." text="Reabra o lead para registrar a venda." />;
  if (block === "already_registered") return <SaleChatBlocked leadId={lead.id} title="A venda deste lead já foi registrada." text="Acompanhe pela tela do lead." />;

  const catalog = await loadSaleCatalog(context.tenantId);
  const value = lead.monthlyValue ? Number(lead.monthlyValue) : null;
  return (
    <SaleChatPage
      lead={{ id: lead.id, name: lead.nome, initials: initials(lead.nome), stageLabel: liteStageLabel(lead.status), monthlyValue: value && Number.isFinite(value) && value > 0 ? value : null }}
      catalog={catalog}
    />
  );
}
