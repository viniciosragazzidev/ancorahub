"use client";

/**
 * Lado cliente da rota de fixtures: os filtros Lite reais (LeadsFilters) e a lista com seleção e barra de lote
 * (LeadsListSwitch), com dados de exemplo. Funções não podem vir de servidor, por isso a seleção mora aqui.
 */
import { useState } from "react";

import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { LeadsFilters } from "@/app/(dashboard)/leads/_components/leads-filters";
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

export function LeadsFixtureList({ leads }: { leads: LeadWorkspaceItem[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <LeadsFilters
        storageKey="dev:diretor-leads-real:filtros"
        branches={BRANCHES}
        brokers={BROKERS}
        tags={TAGS}
      />
      <LeadsListSwitch
        leads={leads}
        contextRole="director"
        shouldMask={false}
        slaFirstContactMinutes={15}
        slaStagnantDays={3}
        pageSize={50}
        selectedIds={selected}
        isAllSelected={selected.length === leads.length}
        onToggleRow={(id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
        onSelectAll={(checked: boolean) => setSelected(checked ? leads.map((lead) => lead.id) : [])}
        onRowClick={() => {}}
        liteBulk={{ role: "director", brokers: BROKERS, branches: BRANCHES }}
      />
    </div>
  );
}
