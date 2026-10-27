import { ChatHome } from "@/components/chat/chat-home";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { getChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { getManagerUnitScope } from "@/features/broker-workspace/manager-unit-scope";
import { LightDashboardUnavailable } from "@/features/broker-workspace/components/light-dashboard";
import { loadNeedsYouIfEnabled } from "@/features/team-management-extras/needs-you-summary";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getBrokerWhatsAppStatusForContext } from "@/features/dashboard/today";

export async function ManagerHomeContent() {
  const context = await getRequiredTenantContext();
  if (!getManagerUnitScope(context)) return <div className="arc-venancor p-6"><EmptyState title="Sua unidade ainda não está configurada" description="Peça ao administrador para vincular seu acesso a uma unidade. Os leads aparecerão aqui quando o vínculo estiver ativo." /></div>;
  const [needs, rail, whatsapp] = await Promise.all([
    loadNeedsYouIfEnabled(context),
    getChatRailData(),
    getBrokerWhatsAppStatusForContext(context).catch(() => null),
  ]);
  const data = rail?.managerUnitSummary;
  if (!rail || !data) return <LightDashboardUnavailable />;

  return <ChatHome viewerName={rail.viewerName} assistants={rail.assistants} leads={rail.leads} nowIso={rail.nowIso} canQuote={false} leadsBadgeCount={rail.leadsBadgeCount} whatsappActivity={whatsapp?.activity} summary={{
    receivedToday: 0,
    acceptedToday: 0,
    inServiceNow: data.inService,
    slaAtRiskNow: data.late,
    duty: null,
    goal: null,
    stats: [
      { label: "Leads na unidade", value: data.leads },
      { label: "Sem corretor", value: data.unassigned },
      { label: "Corretores ativos", value: data.activeBrokers },
      { label: "Corretores sem WhatsApp", value: data.brokersWithoutWhatsApp },
    ],
    next: needs ? { label: needs.phrase, detail: "Abrir a gestão da unidade e ver as equipes.", href: needs.href, urgent: needs.urgent } : {
      label: "Ver leads da unidade",
      detail: data.unassigned ? `${data.unassigned} aguardando atribuição manual.` : "Acompanhe o andamento do time.",
      href: "/leads",
      urgent: data.unassigned > 0,
    },
  }} />;
}
