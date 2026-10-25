// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsListSwitch } from "./leads-lite-list";

// A tabela atual usa nuqs (precisa de adaptador de rota): nos testes, só se confirma que ela foi escolhida.
vi.mock("./leads-data-table", () => ({
  LeadsDataTable: () => <div data-testid="legacy-table" />,
}));

const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("search=Maria&branch=b1"),
  usePathname: () => "/leads",
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}));
// Server Actions do lote: fora do teste da lista.
vi.mock("./status-actions", () => ({
  bulkChangeLeadStatusAction: vi.fn(),
  bulkReassignLeadsAction: vi.fn(),
  bulkReassignBranchAction: vi.fn(),
  bulkRevertToQualificationAction: vi.fn(),
}));

afterEach(cleanup);

describe("cabeçalho e ações da lista Lite", () => {
  it("não repete título nem alternância de visão no corpo; a busca fica nos filtros Lite", () => {
    render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} onRowClick={() => {}} pagination={{ currentPage: 1, pageSize: 20, totalItems: 134, totalPages: 7 }} />
      </ArcScopeProvider>,
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kanban" })).not.toBeInTheDocument();
    expect(screen.getByText("1 a 20 de 134")).toBeInTheDocument();
  });

  it("mostra no máximo 2 etiquetas e o resto em +N", () => {
    const tagged: LeadWorkspaceItem = { ...lead, tags: [1, 2, 3, 4].map((n) => ({ id: `t${n}`, name: `Etiqueta ${n}`, colorHue: n * 40 })) };
    const { container } = render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} leads={[tagged]} onRowClick={() => {}} />
      </ArcScopeProvider>,
    );
    const table = container.querySelector('[data-lite="table"]')!;
    expect(table).toHaveTextContent("Etiqueta 2");
    expect(table).not.toHaveTextContent("Etiqueta 3");
    expect(within(table as HTMLElement).getByText("+2")).toHaveAttribute("title", "Etiqueta 3, Etiqueta 4");
  });

  it("pagina pela URL mantendo os filtros, como a tabela atual", () => {
    window.history.replaceState(null, "", "/leads?search=Maria&branch=b1");
    render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} onRowClick={() => {}} pagination={{ currentPage: 1, pageSize: 20, totalItems: 134, totalPages: 7 }} />
      </ArcScopeProvider>,
    );
    expect(screen.getByText("1 a 20 de 134")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(replace).toHaveBeenCalledWith("/leads?search=Maria&branch=b1&page=2", { scroll: false });
  });

  it("traz de volta etiquetas, fila, qualificação, plantão e os destaques de linha", () => {
    const flagged: LeadWorkspaceItem = {
      ...lead,
      id: "l9",
      nome: "Rita Alves",
      tags: [{ id: "t1", name: "VIP", colorHue: 120 }],
      queueName: "Fila PME",
      queueColorHue: 200,
      isPlantaoAtivo: true,
      isManagementInvestigation: true,
    };
    const returned: LeadWorkspaceItem = { ...lead, id: "l10", nome: "Rui Costa", returnedUnaccepted: true, qualificationStatus: "warm" };
    const { container } = render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} leads={[flagged, returned]} onRowClick={() => {}} />
      </ArcScopeProvider>,
    );
    const table = container.querySelector('[data-lite="table"]')!;
    expect(table).toHaveTextContent("VIP");
    expect(table).toHaveTextContent("Fila PME");
    expect(table).toHaveTextContent("Alta aptidão");
    expect(table).toHaveTextContent("Média aptidão");
    expect(table).toHaveTextContent("Plantão ativo");
    expect(table).toHaveTextContent("Investigação da gestão");
    expect(table).toHaveTextContent("Devolvido, não aceito");
    const rows = table.querySelectorAll("tbody tr");
    expect(rows[0]).toHaveAttribute("data-tone", "muted");
    expect(rows[1]).toHaveAttribute("data-tone", "warning");
  });

  it("a etapa aparece como badge", () => {
    const { container } = render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} onRowClick={() => {}} />
      </ArcScopeProvider>,
    );
    expect(container.querySelector('[data-tone="neutral"]')).not.toBeNull();
  });

  it("o menu da linha tem as ações de hoje e não abre a linha junto", () => {
    const open = vi.fn();
    render(
      <ArcScopeProvider enabled>
        <LeadsListSwitch {...props} onRowClick={open} />
      </ArcScopeProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Ações de Maria Nova" })[0]!);
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("menuitem", { name: "Abrir página completa" })).toHaveAttribute("href", "/leads/l1");
    expect(screen.getByRole("menuitem", { name: "Abrir no WhatsApp" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Abrir drawer de gestão" }));
    expect(open).toHaveBeenCalledWith(lead);
  });
});

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
    expect(screen.getByRole("columnheader", { name: "Corretor e unidade" })).toBeInTheDocument();
  });
});
