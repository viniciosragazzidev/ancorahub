/** ?tela=distribuicao: o Resumo da Distribuição 1:1 (27/11/2026) com dados de exemplo, na moldura real. */
import { DistributionInbox } from "@/app/(dashboard)/leads/distribuicao/_components/distribution-inbox";
import { DirectorDailySummary1a1 } from "@/app/(dashboard)/leads/distribuicao/_components/director-daily-summary-1a1";
import { AssignSection1a1, DistributionHead1a1, LiveStrip1a1 } from "@/app/(dashboard)/leads/distribuicao/_components/resumo-1a1-shell";
import s from "@/app/(dashboard)/leads/distribuicao/_components/resumo-1a1.module.css";
import type { BrokerDailySummaryItem } from "@/features/lead-distribution/broker-summary-service";

const branches = [
  { id: "b-20", name: "Matriz 20º Andar" },
  { id: "b-7", name: "Matriz 7º Andar" },
  { id: "b-ni", name: "Nova Iguaçu" },
  { id: "b-ce", name: "Centro" },
  { id: "b-nt", name: "Niterói" },
];

const brokerRows: [string, string, BrokerDailySummaryItem["availabilityStatus"], number, number, number, number, number, number | null, number, number][] = [
  ["Vitória Augusto", "b-20", "available", 14, 3, 1, 7, 9, 3, 1, 1],
  ["Juliana Portela", "b-7", "busy", 12, 2, 0, 0, 10, 5, 0, 0],
  ["Sara Soares", "b-ni", "available", 11, 1, 1, 9, 8, 2, 1, 1],
  ["Edinaldo Luiz", "b-20", "break", 9, 1, 1, 11, 6, 4, 1, 0],
  ["Raiana Nunes", "b-ce", "available", 8, 0, 0, 0, 7, 1, 1, 1],
  ["Bruno Tavares", "b-nt", "offline", 6, 0, 1, 17, 4, 6, 1, 0],
  ["Carla Menezes", "b-ce", "available", 6, 0, 0, 0, 5, 2, 0, 0],
  ["Diego Fontes", "b-7", "available", 5, 0, 0, 0, 4, 3, 0, 0],
  ["Elaine Prado", "b-ni", "offline", 5, 0, 1, 20, 2, null, 0, 0],
  ["Fábio Ramos", "b-20", "available", 4, 0, 0, 0, 4, 2, 0, 0],
  ["Gisele Moura", "b-nt", "break", 4, 0, 0, 0, 3, 5, 0, 0],
  ["Hugo Lacerda", "b-ce", "available", 3, 0, 0, 0, 3, 1, 0, 0],
];

const items: BrokerDailySummaryItem[] = brokerRows.map(([brokerName, branchId, availabilityStatus, leadsReceived, unstartedLeads, convertedLeads, conversionRate, activeAttending, avgFirstContactMinutes, lostLeads, redistributedLeads], index) => ({
  brokerId: `broker-${index}`,
  brokerName,
  brokerEmail: `corretor${index}@ancora.example`,
  branchId,
  branchName: branches.find((branch) => branch.id === branchId)?.name ?? null,
  availabilityStatus,
  leadsReceived,
  activeAttending,
  unstartedLeads,
  lostLeads,
  convertedLeads,
  conversionRate,
  avgFirstContactMinutes,
  offersReceived: leadsReceived,
  offersAccepted: leadsReceived,
  offersExpired: 0,
  redistributedLeads,
  redistributionRate: leadsReceived ? Math.round((redistributedLeads / leadsReceived) * 100) : 0,
  avgOfferResponseMinutes: null,
}));

const leads = [
  ["Justiniano Albuquerque", "(21) 99883-6148", "hot", "b-ce", "queued", "Meta Lead Ads"],
  ["Cristiane Farizele", "(21) 99883-5017", "warm", null, "unassigned", "Formulário"],
  ["Rita de Cássia França", "(22) 99704-5829", null, null, "manual_hold", null],
  ["Marcos Teixeira", "(21) 99104-2210", "cold", "b-nt", "returned_to_queue", "WhatsApp"],
  ["Paula Rezende", "(21) 98812-4410", "hot", "b-20", "queued", "Meta Lead Ads"],
  ["Otávio Lins", "(21) 97701-3321", "warm", "b-7", "queued", "Formulário"],
].map(([name, phone, qualificationStatus, branchId, distributionStatus, sourceCampaign], index) => ({
  id: `lead-${index}`,
  name: name!,
  phone: phone!,
  branchId,
  distributionStatus: distributionStatus!,
  status: "new",
  qualificationStatus,
  createdAt: new Date(Date.UTC(2026, 10, 27, 12, index * 5)).toISOString(),
  sourceCampaign,
}));

export function DistribuicaoShellScreen() {
  const totalUnstarted = items.reduce((sum, item) => sum + item.unstartedLeads, 0);
  return (
    <main className={`arc-venancor ${s.gx} ${s.page}`} data-skin="diretor">
      <DistributionHead1a1 available={38} waiting={12} />
      <LiveStrip1a1 text="5 de 6 no plantão agora · 22 corretores conectados · última distribuição há 40 s" canAssign showQueue />
      <AssignSection1a1 count={1204}>
        <DistributionInbox
          role="director"
          manualAssignmentChoiceEnabled={false}
          totalUnassigned={1204}
          branches={branches}
          brokers={items.map((item) => ({ id: item.brokerId, name: item.brokerName, branchId: item.branchId, activeLeads: item.activeAttending, availabilityStatus: item.availabilityStatus === "available" ? "available" as const : "paused" as const }))}
          leads={leads}
        />
      </AssignSection1a1>
      <DirectorDailySummary1a1
        branches={branches}
        initialData={{
          totalBrokers: 22,
          totalReceived: 145,
          totalActive: 118,
          totalUnstarted,
          totalLost: 9,
          totalConverted: 4,
          teamConversionRate: 2.8,
          avgTeamResponseMinutes: 4,
          items,
        }}
      />
    </main>
  );
}
