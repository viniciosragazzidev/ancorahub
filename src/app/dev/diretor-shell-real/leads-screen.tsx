"use client";

/**
 * Dev-only: /leads do diretor dentro da moldura real (AppShell), com o workspace real (lista ou kanban), os filtros Lite
 * na mesma barra das visões e dados de exemplo. Mesma composição da página /leads com a chave ligada.
 */
import { DashboardHeader } from "@/components/dashboard-header";
import { LeadsWorkspace } from "@/app/(dashboard)/leads/leads-workspace";
import liteStyles from "@/app/(dashboard)/leads/leads-lite-page.module.css";
import { LEADS } from "@/app/dev/diretor-leads-real/leads-fixtures";

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
];

export function LeadsShellScreen({ view }: { view: "list" | "kanban" }) {
  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Leads" />
      <main className={liteStyles.page}>
        <LeadsWorkspace
          leads={LEADS}
          contextRole="director"
          initialView={view}
          brokers={BROKERS}
          branches={BRANCHES}
          pageSize={6}
          pagination={{ currentPage: 1, pageSize: 6, totalItems: 134, totalPages: 23 }}
          liteFilters={{
            storageKey: "dev:diretor-shell-real:filtros",
            branches: BRANCHES,
            brokers: BROKERS,
            tags: TAGS,
            initialBranch: "branch-centro",
            initialQualification: "hot",
            initialTag: "t1",
          }}
        />
      </main>
    </>
  );
}
