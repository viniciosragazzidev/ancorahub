"use client";

/**
 * Lado cliente da rota de fixtures: os filtros Lite reais (LeadsFilters), a lista com seleção, lote e paginação
 * (LeadsListSwitch) e o kanban Lite (LeadsLiteKanban), com dados de exemplo. `?view=kanban` mostra o kanban.
 * Funções não podem vir de servidor, por isso a seleção e a ordem das colunas moram aqui.
 */
import { arrayMove } from "@dnd-kit/sortable";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { LeadsFilters } from "@/app/(dashboard)/leads/_components/leads-filters";
import { LeadsLiteKanban } from "@/app/(dashboard)/leads/leads-lite-kanban";
import { LeadsListSwitch } from "@/app/(dashboard)/leads/leads-lite-list";

const BRANCHES = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-barra", name: "Barra da Tijuca" },
  { id: "branch-ni", name: "Niterói 1" },
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

const STATUSES = ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis", "converted"];

export function LeadsFixtureList({ leads }: { leads: LeadWorkspaceItem[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState(STATUSES);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = params.get("view") === "kanban" ? "kanban" : "list";
  const grouped = useMemo(() => Object.fromEntries(STATUSES.map((status) => [status, leads.filter((lead) => lead.status === status)])), [leads]);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const changeView = (next: "list" | "kanban") => {
    const query = new URLSearchParams(window.location.search);
    if (next === "list") query.delete("view"); else query.set("view", next);
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };
  const bulk = { role: "director", brokers: BROKERS, branches: BRANCHES };
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <LeadsFilters storageKey="dev:diretor-leads-real:filtros" branches={BRANCHES} brokers={BROKERS} tags={TAGS} />
      {view === "kanban" ? (
        <LeadsLiteKanban
          statuses={order}
          groupedLeads={grouped}
          onMoveColumn={(activeId, overId) => setOrder((current) => arrayMove(current, current.indexOf(activeId), current.indexOf(overId)))}
          onOpen={() => {}}
          isSelected={(id) => selected.includes(id)}
          onToggle={toggle}
          selectedIds={selected}
          onClearSelection={() => setSelected([])}
          bulk={bulk}
        />
      ) : (
        <LeadsListSwitch
          leads={leads}
          contextRole="director"
          shouldMask={false}
          slaFirstContactMinutes={15}
          slaStagnantDays={3}
          pageSize={6}
          pagination={{ currentPage: Number(params.get("page") ?? 1), pageSize: 6, totalItems: 134, totalPages: 23 }}
          selectedIds={selected}
          isAllSelected={selected.length === leads.length}
          onToggleRow={toggle}
          onSelectAll={(checked: boolean) => setSelected(checked ? leads.map((lead) => lead.id) : [])}
          onRowClick={() => {}}
          onViewChange={changeView}
          liteBulk={bulk}
        />
      )}
    </div>
  );
}
