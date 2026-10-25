/** Dados de exemplo do NOC (dev e testes): nomes longos, unidade crítica e em atenção, números grandes. */
import type { NocData } from "@/features/noc/queries";

export const NOC_NOW = "2026-10-25T01:30:00.000Z";

const minutesAgo = (minutes: number) => new Date(new Date(NOC_NOW).getTime() - minutes * 60_000);

export const NOC_FIXTURE: NocData = {
  kpis: {
    leadsToday: 1284,
    leadsTodayVsYesterday: 12,
    activeAttendances: 317,
    conversionRateMonth: 18,
    conversionRateLastMonth: 16,
    avgFirstContactSeconds: 312,
    avgFirstContactSecondsYesterday: 355,
    avgTicketMonth: 1840,
    avgTicketLastMonth: 1720,
  },
  leadFlow: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia, index) => ({
    dia,
    date: new Date(Date.UTC(2026, 9, 18 + index)).toISOString(),
    leads: [820, 1310, 1255, 1402, 1288, 1190, 1284][index]!,
    contatos: [610, 1040, 990, 1120, 1015, 950, 1001][index]!,
    conversoes: [120, 230, 214, 260, 231, 205, 219][index]!,
  })),
  statusDistribution: [
    { name: "Novos", value: 4210, color: "var(--chart-1)" },
    { name: "Distribuídos", value: 3180, color: "var(--chart-2)" },
    { name: "Em Contato", value: 2950, color: "var(--chart-3)" },
    { name: "Cotação", value: 1460, color: "var(--chart-4)" },
    { name: "Negociação", value: 980, color: "var(--chart-5)" },
    { name: "Documentação", value: 410, color: "var(--chart-1)" },
    { name: "Convertidos", value: 1630, color: "var(--chart-2)" },
    { name: "Perdidos", value: 2240, color: "var(--chart-3)" },
  ],
  hourlyActivity: Array.from({ length: 12 }, (_, index) => ({ hora: `${String(8 + index).padStart(2, "0")}h`, leads: [42, 88, 121, 140, 132, 96, 110, 128, 117, 98, 74, 51][index]!, contatos: [30, 70, 98, 120, 111, 80, 94, 101, 99, 82, 60, 40][index]! })),
  teamPerformance: [
    { userId: "u1", nome: "Maximiliano Cavalcanti Rocha", leads: 64, conversoes: 29, taxa: 45 },
    { userId: "u2", nome: "Ana Souza", leads: 58, conversoes: 19, taxa: 33 },
    { userId: "u3", nome: "Bruno Lima", leads: 51, conversoes: 12, taxa: 24 },
    { userId: "u4", nome: "Carla Dias", leads: 47, conversoes: 7, taxa: 15 },
    { userId: "u5", nome: "Roseleia Oliveira Bittencourt", leads: 39, conversoes: 4, taxa: 10 },
  ],
  recentActivity: [
    { id: "a1", type: "conversion", message: "Venda fechada: Padaria Nova Esperança Ltda (Bradesco Saúde Top Nacional Flex)", time: minutesAgo(1), user: "Ana Souza", branchName: "Centro" },
    { id: "a2", type: "new_lead", message: "Novo lead: Justiniano Albuquerque de Souza", time: minutesAgo(4), user: "Distribuição automática", branchName: "Barra da Tijuca" },
    { id: "a3", type: "alert", message: "Lead sem contato há mais de 15 min: Cristiane Farizele Monteiro", time: minutesAgo(9), user: "Sistema", branchName: "Niterói 1" },
    { id: "a4", type: "quote", message: "Cotação enviada para Clínica Odontológica Sorriso Pleno", time: minutesAgo(22), user: "Maximiliano Cavalcanti Rocha", branchName: "Centro" },
    { id: "a5", type: "status_change", message: "Bartolomeu Wanderley Castelo Branco passou para negociação", time: minutesAgo(48), user: "Bruno Lima", branchName: null },
    { id: "a6", type: "new_lead", message: "Novo lead: Transportadora Rápido Carioca", time: minutesAgo(75), user: "Distribuição automática", branchName: "Barra da Tijuca" },
    { id: "a7", type: "conversion", message: "Venda fechada: Nazareth Gonçalves Pereira (Amil S380 QC Nacional)", time: minutesAgo(130), user: "Carla Dias", branchName: "Niterói 1" },
    { id: "a8", type: "quote", message: "Cotação enviada para Roseleia Oliveira Bittencourt", time: minutesAgo(190), user: "Ana Souza", branchName: "Centro" },
    { id: "a9", type: "status_change", message: "Juliana Prado passou para documentação pendente", time: minutesAgo(1600), user: "Bruno Lima", branchName: "Centro" },
  ],
  branchHealth: [
    { id: "br-centro", name: "Centro", acceptingLeads: true, leadsToday: 512, activeAttendances: 140, unassignedLeads: 0, slaRiskLeads: 0, availableBrokers: 18, totalBrokers: 22, health: "healthy", healthReason: "Fila em dia e corretores disponíveis" },
    { id: "br-barra", name: "Barra da Tijuca", acceptingLeads: true, leadsToday: 431, activeAttendances: 102, unassignedLeads: 14, slaRiskLeads: 3, availableBrokers: 4, totalBrokers: 15, health: "attention", healthReason: "14 leads aguardando corretor" },
    { id: "br-niteroi", name: "Niterói 1", acceptingLeads: false, leadsToday: 341, activeAttendances: 75, unassignedLeads: 37, slaRiskLeads: 21, availableBrokers: 0, totalBrokers: 9, health: "critical", healthReason: "21 leads com risco de SLA e nenhum corretor disponível" },
    { id: "br-campo", name: "Campo Grande e Zona Oeste", acceptingLeads: true, leadsToday: 0, activeAttendances: 0, unassignedLeads: 0, slaRiskLeads: 0, availableBrokers: 6, totalBrokers: 6, health: "healthy", healthReason: "Sem leads hoje" },
  ],
  firstContactTrend: [410, 380, 355, 342, 330, 355, 312],
  ticketTrend: [1690, 1720, 1810, 1760, 1880, 1790, 1840],
};
