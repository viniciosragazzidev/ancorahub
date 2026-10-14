import { ChatHome } from "@/components/chat/chat-home";
import type { ThreadSummary } from "@/components/chat/types";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { getManagerLiteLeads } from "@/features/supervisor-workspace/manager-lite-queries";
import { LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";

export async function ManagerHomeContent() {
  const context = await getRequiredTenantContext();
  if (!getManagerUnitScope(context)) return <div className="arc-venancor p-6"><EmptyState title="Sua unidade ainda não está configurada" description="Peça ao administrador para vincular seu acesso a uma unidade. Os leads aparecerão aqui quando o vínculo estiver ativo." /></div>;
  const data = await getManagerLiteLeads(context).catch(() => null);
  if (!data) return <LightDashboardUnavailable />;
  const thread: ThreadSummary = {
    id: "assistant:equipe-leads", kind: "assistant", assistant: "equipe-leads", name: "Leads da unidade", verified: true,
    preview: data ? `${data.leads.length} leads na unidade. Abra para acompanhar e repassar.` : "Acompanhe e repasse os leads da sua unidade.",
    at: null, unread: false, waitingYou: Boolean(data?.leads.some((lead) => !lead.ownerId)), href: "/leads", shape: "logo", hue: null,
  };
  const unresolved = data?.leads.filter((lead) => !lead.ownerId).length ?? 0;
  return <ChatHome viewerName={data?.viewerName ?? "Gestor"} assistants={[thread]} leads={[]} nowIso={new Date().toISOString()} canQuote={false} summary={{
    receivedToday: 0, acceptedToday: 0, inServiceNow: data?.leads.filter((lead) => ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)).length ?? 0,
    slaAtRiskNow: data?.team.reduce((total, member) => total + member.late, 0) ?? 0, duty: null, goal: null,
    stats: [
      { label: "Leads na unidade", value: data?.leads.length ?? 0 },
      { label: "Sem corretor", value: unresolved },
      { label: "Corretores ativos", value: data?.team.length ?? 0 },
    ],
    next: { label: "Ver leads da unidade", detail: unresolved ? `${unresolved} aguardando atribuição manual.` : "Acompanhe o andamento do time.", href: "/leads", urgent: unresolved > 0 },
  }} />;
}
