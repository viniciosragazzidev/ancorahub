"use client";

/**
 * Dev-only: as telas da Onda 10 no visual Lite dentro da moldura real, com dados de exemplo realistas (nomes longos,
 * clientes sem responsável, várias páginas). Cada tela usa os mesmos componentes Lite da página real.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import litePage from "@/components/lite/page/lite-page.module.css";
import { ClientesLite, type ClientLiteRow } from "@/app/(dashboard)/clientes/clientes-lite";
import { ArchivedLeadsLite, type ArchivedLeadLiteRow } from "@/app/(dashboard)/leads/arquivados/archived-leads-lite";
import { DomainDashboardLite } from "@/features/dashboard/components/domain-dashboard-lite";
import { LeadsOverviewLite } from "@/features/dashboard/components/leads-overview-lite";

const NAMES = [
  "Justiniano Albuquerque de Souza", "Padaria Nova Esperança Ltda", "Cristiane Farizele Monteiro", "Bartolomeu Wanderley Castelo Branco",
  "Ana Ribeiro", "Nazareth Pereira", "Maximiliano Cavalcanti Rocha", "Helena Vasconcelos", "Igor Batista", "Lúcia Fernandes de Moraes",
  "Oficina Mecânica Irmãos Siqueira ME", "Rafaela Duarte",
];
const BROKERS = ["Ana Souza", "Bruno Lima", "Carla Dias", "Maximiliano Cavalcanti Rocha"];
const BRANCHES = [{ id: "branch-centro", name: "Centro" }, { id: "branch-barra", name: "Barra da Tijuca" }, { id: "branch-ni", name: "Niterói 1" }];

export function ClientesShellScreen() {
  const clients: ClientLiteRow[] = NAMES.concat(NAMES.map((name) => `${name} (2)`)).map((name, index) => ({
    id: `client-${index + 1}`,
    name,
    phone: `+55 21 9${String(8000_0000 + index * 7919).slice(0, 4)}-${String(1000 + index).slice(-4)}`,
    email: index % 3 === 0 ? null : `${name.split(" ")[0]!.toLowerCase()}.${index}@example.test`,
    convertedAt: new Date(Date.UTC(2026, 9, 24 - (index % 25), 14, 30)).toISOString(),
    brokerName: index % 6 === 5 ? null : BROKERS[index % BROKERS.length]!,
    branchName: index % 7 === 6 ? null : BRANCHES[index % BRANCHES.length]!.name,
  }));
  return (
    <>
      <DashboardHeader breadcrumb="Pós-venda" title="Clientes" />
      <main className={litePage.stack}>
        <ClientesLite
          clients={clients}
          metrics={{ totalClients: clients.length, conversionRate: "8.4", avgClientsPerBroker: 6, upcomingRenewals: 5, recentConversions: clients.length, totalBrokers: 4 }}
          period={30}
          branches={BRANCHES}
        />
      </main>
    </>
  );
}

const STATUSES = ["lost", "in_contact", "new", null, "negotiation"];
const QUALIFICATIONS = ["cold", "hot", null, "no_whatsapp_contact", "pending"];

export function ArquivadosShellScreen() {
  const rows: ArchivedLeadLiteRow[] = NAMES.map((name, index) => ({
    id: `archived-${index + 1}`,
    name,
    phone: `+55 21 9${String(7000_0000 + index * 6151).slice(0, 4)}-${String(2000 + index).slice(-4)}`,
    email: index % 2 === 0 ? `${name.split(" ")[0]!.toLowerCase()}@example.test` : null,
    status: STATUSES[index % STATUSES.length]!,
    qualificationStatus: QUALIFICATIONS[index % QUALIFICATIONS.length]!,
    archivedAt: index === 3 ? null : new Date(Date.UTC(2026, 9, 2 + index, 13 + (index % 6), 5 * index)).toISOString(),
    archivedBy: index % 4 === 1 ? null : BROKERS[index % BROKERS.length]!,
  }));
  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Leads arquivados"
        rightSlot={<a href="/leads" className={litePage.button}>Voltar para leads</a>}
      />
      <main className={litePage.stack}>
        <ArchivedLeadsLite rows={rows} total={137} page={1} totalPages={3} pageSize={50} search="" />
      </main>
    </>
  );
}

export function VisaoConversasShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Conversas" title="Visão geral" />
      <main className={litePage.stack}>
        <DomainDashboardLite
          data={{
            title: "Conversas",
            description: "Atendimentos abertos, respostas pendentes e tempo de resposta no seu escopo.",
            metrics: [{ label: "Conversas abertas", value: 148 }, { label: "Sem resposta", value: 23 }, { label: "Aguardando cliente", value: 61 }, { label: "Tempo médio de resposta", value: "12 min" }],
            actionHref: "/conversas",
          }}
        />
      </main>
    </>
  );
}

export function VisaoLeadsShellScreen() {
  return (
    <>
      <DashboardHeader breadcrumb="Leads" title="Visão geral de leads" rightSlot={<a href="/leads" className={litePage.button}>Abrir lista</a>} />
      <main className={litePage.stack}>
        <LeadsOverviewLite
          period={7}
          metrics={[["Novos hoje", 42], ["Conversão", "12,3%"], ["Sem responsável", 7], ["Em risco", 19]]}
          attention={[
            { id: "high-intent-unassigned", title: "Alta intenção sem responsável", description: "Leads quentes que ainda não foram distribuídos para nenhum corretor", count: 7, href: "/leads" },
            { id: "stale", title: "Negociações paradas", description: "Sem movimentação há mais de 5 dias", count: 12, href: "/leads" },
          ]}
          attentionCount={19}
          stages={[{ stage: "Novo", inStage: 42 }, { stage: "Em atendimento", inStage: 88 }, { stage: "Cotação enviada", inStage: 37 }, { stage: "Negociação", inStage: 21 }, { stage: "Documentação pendente", inStage: 9 }]}
        />
      </main>
    </>
  );
}
