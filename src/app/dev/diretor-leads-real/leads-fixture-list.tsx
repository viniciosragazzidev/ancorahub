"use client";

/** Lado cliente da rota de fixtures: recebe os dados e as funções da lista (funções não podem vir de servidor). */
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";
import { LeadsListSwitch } from "@/app/(dashboard)/leads/leads-lite-list";

export function LeadsFixtureList({ leads }: { leads: LeadWorkspaceItem[] }) {
  return (
    <LeadsListSwitch
      leads={leads}
      contextRole="director"
      shouldMask={false}
      slaFirstContactMinutes={15}
      slaStagnantDays={3}
      pageSize={50}
      selectedIds={new Set<string>()}
      isAllSelected={false}
      onToggleRow={() => {}}
      onSelectAll={() => {}}
      onRowClick={() => {}}
    />
  );
}
