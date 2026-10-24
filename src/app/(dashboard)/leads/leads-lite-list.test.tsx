// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsListSwitch } from "./leads-lite-list";

// A tabela atual usa nuqs (precisa de adaptador de rota): nos testes, só se confirma que ela foi escolhida.
vi.mock("./leads-data-table", () => ({
  LeadsDataTable: () => <div data-testid="legacy-table" />,
}));

afterEach(cleanup);

const lead: LeadWorkspaceItem = {
  id: "l1",
  nome: "Maria Nova",
  telefone: "21 90000-0101",
  status: "new",
  qualificationStatus: "hot",
  origem: "Meta Ads",
  sourceCampaign: null,
  tipo: "PME",
  createdAt: "2026-10-24T14:02:00.000Z",
  assignedAt: null,
  stageEnteredAt: null,
  serviceStartedAt: null,
  firstContactAt: null,
  corretorId: null,
  corretorNome: null,
  branchId: "branch-centro",
  branchName: "Centro",
};

const props = {
  leads: [lead],
  contextRole: "director",
  shouldMask: false,
  slaFirstContactMinutes: 15,
  slaStagnantDays: 3,
  pageSize: 50,
  selectedIds: new Set<string>(),
  isAllSelected: false,
  onToggleRow: () => {},
  onSelectAll: () => {},
};

describe("LeadsListSwitch", () => {
  it("com a chave ligada, mostra a lista Lite e abre o lead ao tocar na linha", () => {
    const open = vi.fn();
    const { container } = render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} onRowClick={open} />
      </ArcScopeProvider>,
    );
    expect(container.querySelector('[data-lite="table"]')).not.toBeNull();
    // Tabela e cartões renderizam o mesmo lead; a abertura vale para qualquer um deles.
    fireEvent.click(screen.getAllByText("Maria Nova")[0]!);
    expect(open).toHaveBeenCalledWith(lead);
  });

  it("com a chave desligada, mantém a tabela atual (sem a lista Lite)", () => {
    const { container } = render(
      <ArcScopeProvider enabled={false}>
        <LeadsListSwitch {...props} onRowClick={() => {}} />
      </ArcScopeProvider>,
    );
    expect(container.querySelector('[data-lite="table"]')).toBeNull();
    expect(container.querySelector('[data-testid="legacy-table"]')).not.toBeNull();
  });

  it("para o corretor, a origem some da lista Lite", () => {
    render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} contextRole="broker" onRowClick={() => {}} />
      </ArcScopeProvider>,
    );
    expect(screen.queryByRole("columnheader", { name: "Origem" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Corretor" })).toBeInTheDocument();
  });
});
