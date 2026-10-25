"use client";

/**
 * Dev-only: /leads do diretor dentro da moldura real (AppShell), com o workspace real (todas as visões), as ações do
 * topo, os filtros Lite e dados de exemplo realistas: nomes longos, 12 filas com nomes em caixa alta e contagens
 * grandes, 1.774 leads no filtro, Qualificação IA e Sem atribuição com leads. Mesma composição da página /leads.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import { LeadsHeaderActions } from "@/app/(dashboard)/leads/_components/leads-header-actions";
import { LeadsWorkspace, type QualifyingLeadItem } from "@/app/(dashboard)/leads/leads-workspace";
import liteStyles from "@/app/(dashboard)/leads/leads-lite-page.module.css";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { RADAR_FIXTURES } from "@/features/conversation-intelligence/components/radar-fixtures";

const BRANCHES = [
  { id: "branch-centro", name: "Centro", status: "active", acceptingLeads: true, isDistributionHub: false },
  { id: "branch-barra", name: "Barra da Tijuca", status: "active", acceptingLeads: true, isDistributionHub: false },
  { id: "branch-ni", name: "Niterói 1", status: "active", acceptingLeads: true, isDistributionHub: false },
];

const BROKERS = [
  { id: "b1", name: "Ana Souza", branchId: "branch-centro" },
  { id: "b2", name: "Bruno Lima", branchId: "branch-barra" },
  { id: "b3", name: "Carla Dias", branchId: "branch-ni" },
];

const TAGS = [
  { id: "t1", name: "VIP", colorHue: 280 },
  { id: "t2", name: "Retorno", colorHue: 30 },
  { id: "t3", name: "Indicação", colorHue: 140 },
];

// 12 filas como chegam dos dados (caixa alta e nomes longos), com contagens grandes.
const QUEUES = [
  ["q1", "FILA TATIANA", 1774], ["q2", "FILA PF - RENAN", 912], ["q3", "FILA PME - RENAN", 769], ["q4", "Leads Frios", 425],
  ["q5", "Pós Venda", 71], ["q6", "FILA GERAL ZONA NORTE", 64], ["q7", "CALLEX", 38], ["q8", "FILA ADESÃO SERVIDORES PÚBLICOS", 27],
  ["q9", "FILA SENIOR 59+", 19], ["q10", "FILA ODONTO", 11], ["q11", "FILA EMPRESARIAL GRANDES CONTAS", 6], ["q12", "Fila geral", 4],
] as const;
const QUEUE_TABS = [
  { value: "", label: "Todas", count: QUEUES.reduce((sum, [, , count]) => sum + count, 0) },
  ...QUEUES.map(([value, label, count]) => ({ value, label, count })),
];

const BASE = {
  qualificationStatus: "cold",
  origem: "webhook",
  sourceCampaign: "Campanha PME",
  sourceChannel: "whatsapp_ctwa",
  tipo: "PF",
  assignedAt: null,
  stageEnteredAt: null,
  serviceStartedAt: null,
  firstContactAt: null,
  corretorId: null,
  corretorNome: null,
  branchId: "branch-centro",
  branchName: "Centro",
  queueId: "q1",
  queueName: "FILA TATIANA",
  queueColorHue: 300,
} satisfies Partial<LeadWorkspaceItem>;

const NAMES = [
  "Justiniano Albuquerque de Souza", "Cristiane Farizele Monteiro", "Nazareth Gonçalves Pereira", "Roseleia Oliveira Bittencourt",
  "Maximiliano Cavalcanti Rocha", "Ana", "Bartolomeu Wanderley Castelo Branco", "Juliana Prado",
];
const STATUSES = ["new", "new", "distributed", "in_contact", "quote_sent", "negotiation", "converted", "lost"];

const LEADS: LeadWorkspaceItem[] = NAMES.map((nome, index) => ({
  ...BASE,
  id: `l${index + 1}`,
  nome,
  telefone: `55219${String(98836148 - index * 1111).padStart(8, "0")}`,
  status: STATUSES[index] ?? "new",
  qualificationStatus: index % 3 === 0 ? "hot" : "cold",
  tags: index === 0 ? TAGS : index === 3 ? TAGS.slice(1, 2) : [],
  corretorId: index > 1 ? "b1" : null,
  corretorNome: index > 1 ? "Ana Souza" : null,
  isPlantaoAtivo: index === 2,
  // As 3 primeiras trazem a leitura da IA do Radar (quente, em risco, pendente no corretor).
  qualificationDetails: index < 3 ? (RADAR_FIXTURES[index]?.qualificationDetails ?? null) : null,
  returnedUnaccepted: index === 1,
  createdAt: new Date(Date.UTC(2026, 9, 24, 14 - index, 2)).toISOString(),
}));

// 60 leads em qualificação: a lista Lite pagina de 20 em 20 no cliente.
const QUALIFYING_NAMES = ["Katia Regina Albuquerque", "Adelair Oliveira dos Santos", "Carlos Souza", "Maria Eduarda Fontes", "Raimundo Nonato Silva"];
const QUALIFYING: QualifyingLeadItem[] = Array.from({ length: 60 }, (_, index) => `${QUALIFYING_NAMES[index % QUALIFYING_NAMES.length]} ${index + 1}`).map((nome, index) => ({
  id: `q-${index}`,
  nome,
  telefone: `55229${97502806 - index * 7}`,
  email: null,
  status: "new",
  qualificationStatus: index === 2 ? "qualifying" : "pending",
  qualificationState: "IN_PROGRESS",
  qualificationScore: 0,
  origem: "webhook",
  sourceChannel: "whatsapp_ctwa",
  tipo: "PF",
  queueName: "FILA TATIANA",
  queueColorHue: 300,
  branchName: "Centro",
  createdAt: new Date(Date.UTC(2026, 9, 23, 16 - (index % 12), 39)).toISOString(),
}));

const UNASSIGNED: LeadWorkspaceItem[] = LEADS.slice(0, 4).map((lead) => ({ ...lead, id: `u-${lead.id}`, corretorId: null, corretorNome: null, status: "new" }));

export function LeadsShellScreen({ view, role = "director", jobTitle = "director", branchId = null }: { view: "list" | "kanban" | "qualificacoes" | "sem-atribuicao" | "radar"; role?: "director" | "manager" | "supervisor" | "broker"; jobTitle?: string; branchId?: string | null }) {
  const isDirector = role === "director";
  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Leads"
        rightSlot={(
          <LeadsHeaderActions
            period={30}
            plans={[]}
            branches={BRANCHES}
            queues={QUEUES.map(([id, name]) => ({ id, name, branchId: null }))}
            role={role}
            jobTitle={jobTitle}
            branchId={branchId}
            urgentLead={{ id: "l1", nome: "Justiniano Albuquerque de Souza", status: "new", urgentReason: "Primeiro contato vence em 3 min" }}
          />
        )}
      />
      <main className={liteStyles.page}>
        <LeadsWorkspace
          leads={LEADS}
          qualifyingLeads={QUALIFYING}
          contextRole={role}
          initialView={view}
          brokers={BROKERS}
          branches={BRANCHES}
          showUnassignedFilter={isDirector}
          unassignedLeads={UNASSIGNED}
          unassignedPagination={{ currentPage: 1, pageSize: 20, totalItems: 361, totalPages: 19 }}
          pageSize={20}
          pagination={{ currentPage: 1, pageSize: 20, totalItems: 1774, totalPages: 89 }}
          liteFilters={{
            storageKey: "dev:diretor-shell-real:filtros",
            branches: BRANCHES,
            brokers: BROKERS,
            tags: TAGS,
            queueTabs: { tabs: QUEUE_TABS, current: "q1" },
            period: 30,
          }}
        />
      </main>
    </>
  );
}
