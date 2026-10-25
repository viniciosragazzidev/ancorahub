"use client";

/**
 * Dev-only: as telas da Onda 3 no visual Lite dentro da moldura real, com dados de exemplo realistas (nomes longos,
 * valores grandes, várias unidades). Cada tela usa os mesmos componentes Lite da página real.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import { LiteRelatedLinks } from "@/components/lite/page/related-links";
import litePage from "@/components/lite/page/lite-page.module.css";
import { SalesWorkspaceLite, type SaleLiteRow } from "@/app/(dashboard)/vendas/sales-workspace-lite";
import { SaleDetailLite } from "@/app/(dashboard)/vendas/[id]/sale-detail-lite";
import { PropostasLite } from "@/app/(dashboard)/propostas/_components/propostas-lite";
import { PROPOSAL_FIXTURES, PROPOSAL_LEADS } from "@/app/(dashboard)/propostas/_components/proposals-fixtures";
import { DocumentsLite } from "@/features/documents/components/documents-lite";
import { DrilldownLite } from "@/app/(dashboard)/relatorios/drill/_components/drilldown-lite";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import { CARRIER_FIXTURES, DOC_FIXTURES, PLAN_FIXTURES, REQUIREMENT_FIXTURES } from "@/features/documents/components/documents-fixtures";

const BRANCHES = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-barra", name: "Barra da Tijuca" },
  { id: "branch-ni", name: "Niterói 1" },
];

const SALE_NAMES = [
  "Justiniano Albuquerque de Souza", "Padaria Nova Esperança Ltda", "Cristiane Farizele Monteiro", "Bartolomeu Wanderley Castelo Branco",
  "Nazareth Gonçalves Pereira", "Clínica Odontológica Sorriso Pleno", "Roseleia Oliveira Bittencourt", "Ana", "Maximiliano Cavalcanti Rocha",
  "Transportadora Rápido Carioca", "Juliana Prado", "Raimundo Nonato Silva",
];
const PLANS = [["Amil S380 QC Nacional", "Amil"], ["Bradesco Saúde Top Nacional Flex", "Bradesco Saúde"], ["SulAmérica Exato", "SulAmérica"], ["Unimed Rio Pleno", "Unimed"]] as const;

export const SALES: SaleLiteRow[] = SALE_NAMES.map((name, index) => ({
  id: `sale-${index + 1}`,
  leadId: `lead-${index + 1}`,
  leadName: name,
  clientName: index % 3 === 0 ? name.split(" ").slice(0, 2).join(" ") : null,
  brokerId: `b${(index % 3) + 1}`,
  brokerName: ["Ana Souza", "Bruno Lima", "Carla Dias"][index % 3] ?? null,
  branchName: BRANCHES[index % 3]?.name ?? null,
  planName: PLANS[index % 4]?.[0] ?? null,
  carrierName: PLANS[index % 4]?.[1] ?? null,
  saleDate: new Date(Date.UTC(2026, 9, 24 - index, 15, 0)).toISOString(),
  saleValue: [12850.4, 1980, 642.9, 31200, 2340.5, 8760, 990, 455.3, 15400, 47210.8, 1205, 3399][index] ?? 1000,
  status: index === 2 || index === 7 ? "cancelled" : "active",
  createdAt: new Date(Date.UTC(2026, 9, 24 - index, 15, 0)).toISOString(),
}));

export function VendasShellScreen() {
  const totalRevenue = SALES.reduce((sum, sale) => sum + sale.saleValue, 0);
  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Vendas" />
      <main className={litePage.stack}>
        <SalesWorkspaceLite sales={SALES} totalRevenue={totalRevenue} currentRole="director" period={30} branches={BRANCHES} />
        <LiteRelatedLinks
          title="Navegação comercial relacionada"
          description="Funções ligadas a vendas e faturamento."
          links={[
            { label: "Ver base de clientes", href: "/clientes", description: "Gestão da carteira de contratos ativos" },
            { label: "Tabela de comissões", href: "/settings?tab=comissoes", description: "Regras de comissionamento por produto" },
            { label: "Anexar documentos de propostas", href: "/documentos", description: "Conferência de documentos e apólices" },
            { label: "Relatório de desempenho", href: "/dashboard?tab=commercial", description: "Métricas de fechamento por corretor" },
          ]}
        />
      </main>
    </>
  );
}

const SCHEDULE = Array.from({ length: 6 }, (_, index) => ({
  id: `p${index + 1}`,
  saleId: "sale-1",
  monthNumber: index + 1,
  referenceMonth: `2026-${String(10 + index > 12 ? index - 2 : 10 + index).padStart(2, "0")}`,
  dueDate: new Date(Date.UTC(2026, 9 + index, 10)).toISOString(),
  percentage: index === 0 ? "100" : "20",
  amount: index === 0 ? "12850.40" : "2570.08",
  status: (index < 2 ? "paid" : index === 5 ? "cancelled" : "pending") as "paid" | "pending" | "cancelled",
  paidAt: index < 2 ? new Date(Date.UTC(2026, 9 + index, 12)).toISOString() : null,
  paidBy: index < 2 ? "director-1" : null,
  paidByName: index < 2 ? "Marina Exemplo" : null,
  notes: null,
}));

export function VendaShellScreen() {
  const first = SALES[0]!;
  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial / Vendas" title="Detalhes da venda" />
      <main className={litePage.stack}>
        <SaleDetailLite
          sale={{
            id: "7f3c2a91-1111-4111-8111-111111111111",
            leadId: first.leadId,
            leadName: first.leadName,
            clientName: first.clientName,
            brokerName: first.brokerName,
            branchName: first.branchName,
            planName: first.planName,
            carrierName: first.carrierName,
            ruleName: "Amil PME: 100% + 5 x 20%",
            status: "active",
            saleDate: first.saleDate,
            saleValue: first.saleValue,
            notes: "Cliente pediu boleto com vencimento no dia 10. Contrato assinado digitalmente em 24/10.",
          }}
          schedule={SCHEDULE}
          canManage
        />
      </main>
    </>
  );
}

export function PropostasShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Propostas" />
      <main className={litePage.stack}>
        <PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={PROPOSAL_FIXTURES.slice(0, 3)} leads={PROPOSAL_LEADS} />
      </main>
    </>
  );
}

export function DocumentosShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Documentos" />
      <main className={litePage.stack}>
        <DocumentsLite carriers={CARRIER_FIXTURES} plans={PLAN_FIXTURES} initialRequirements={REQUIREMENT_FIXTURES} initialPendingDocs={DOC_FIXTURES} />
      </main>
    </>
  );
}

export function TarefasShellScreen() {
  const data = { title: "Visão de tarefas", description: "Execução e pendências do período.", metrics: [{ label: "Em aberto", value: 1284 }, { label: "Com prazo", value: 317 }, { label: "Criadas", value: 942 }], actionHref: "/tarefas" };
  return (
    <>
      <DashboardHeader breadcrumb="Tarefas" title="Visão geral" />
      <main className={litePage.stack}>
        <DomainDashboardLite data={data} actionLabel="Abrir tarefas" />
      </main>
    </>
  );
}

const DRILL_STATUSES = ["negotiation", "documentation_pending", "under_analysis", "in_contact", "quote_sent"];

export function DrillShellScreen() {
  const rows = SALE_NAMES.concat(SALE_NAMES.map((name) => `${name} (2)`)).map((name, index) => ({
    id: `lead-${index + 1}`,
    nome: name,
    status: DRILL_STATUSES[index % DRILL_STATUSES.length]!,
    brokerName: index % 5 === 4 ? null : ["Ana Souza", "Bruno Lima", "Carla Dias", "Maximiliano Cavalcanti Rocha"][index % 4]!,
    branchName: BRANCHES[index % 3]?.name ?? null,
    createdAt: new Date(Date.UTC(2026, 9, 24 - (index % 20), 1, 30)).toISOString(),
  }));
  const brokers = [
    { brokerId: "b1", brokerName: "Maximiliano Cavalcanti Rocha", activeLeads: 48, capacity: 30 },
    { brokerId: "b2", brokerName: "Ana Souza", activeLeads: 36, capacity: 30 },
    { brokerId: "b3", brokerName: "Bruno Lima", activeLeads: 31, capacity: 25 },
  ];
  return (
    <>
      <DashboardHeader breadcrumb="Relatórios / Negociações paradas" title="Negociações paradas" rightSlot={<a href="/dashboard?period=30&tab=overview" className={litePage.button}>Voltar</a>} />
      <main className={litePage.stack}>
        <DrilldownLite explanation="Leads em negociação, documentação ou análise cuja entrada na etapa atual excede o prazo de estagnação do tenant." total={312} rows={rows} brokers={brokers} />
      </main>
    </>
  );
}
