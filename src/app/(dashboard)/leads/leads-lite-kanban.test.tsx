// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { BrokerProfileViewerProvider } from "@/components/broker-profile-link";

import { LeadsLiteKanban } from "./leads-lite-kanban";

const actions = vi.hoisted(() => ({
  changeLeadStatusAction: vi.fn(async () => ({ success: true })),
  bulkChangeLeadStatusAction: vi.fn(async (_state: unknown, form: FormData) => ({ success: true, changedLeadIds: form.getAll("leadIds") })),
}));

vi.mock("./status-actions", () => ({
  changeLeadStatusAction: actions.changeLeadStatusAction,
  bulkChangeLeadStatusAction: actions.bulkChangeLeadStatusAction,
  bulkReassignLeadsAction: vi.fn(),
  bulkReassignBranchAction: vi.fn(),
  bulkRevertToQualificationAction: vi.fn(),
}));

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T15:00:00.000Z"));
});

afterEach(cleanup);

const base = {
  qualificationStatus: "hot",
  origem: "Meta Ads",
  sourceCampaign: null,
  tipo: "PME",
  assignedAt: null,
  stageEnteredAt: null,
  serviceStartedAt: null,
  firstContactAt: null,
  corretorId: null,
  corretorNome: null,
  branchId: "b1",
  branchName: "Centro",
} satisfies Partial<LeadWorkspaceItem>;

const maria: LeadWorkspaceItem = { ...base, branchName: null, id: "l1", nome: "Maria Nova", telefone: "21 90000-0101", status: "new", createdAt: "2026-10-24T14:02:00.000Z" };
const carlos: LeadWorkspaceItem = { ...base, id: "l2", nome: "Carlos Mendes", telefone: "21 90000-0102", status: "in_contact", corretorId: "c1", corretorNome: "Ana Souza", stageEnteredAt: "2026-10-23T10:00:00.000Z", createdAt: "2026-10-23T09:40:00.000Z" };

function renderKanban(extra: Partial<Parameters<typeof LeadsLiteKanban>[0]> = {}) {
  const props = {
    statuses: ["new", "in_contact", "quote_sent"],
    groupedLeads: { new: [maria], in_contact: [carlos], quote_sent: [] },
    onMoveColumn: vi.fn(),
    onOpen: vi.fn(),
    isSelected: (id: string) => id === "l2",
    onToggle: vi.fn(),
    selectedIds: ["l2"],
    onClearSelection: vi.fn(),
    bulk: { role: "director", brokers: [], branches: [] },
    ...extra,
  };
  render(<BrokerProfileViewerProvider viewerRole="director"><LeadsLiteKanban {...props} /></BrokerProfileViewerProvider>);
  return props;
}

describe("kanban Lite de /leads", () => {
  it("colunas com rótulo em sentence case e cartão com as informações de hoje", () => {
    renderKanban();
    expect(screen.getByRole("heading", { name: "Em atendimento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cotação enviada" })).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Sem corretor")).toBeInTheDocument();
    expect(screen.getAllByText(/restantes|atrasado/).length).toBeGreaterThan(0);
    // Cartão do artifact (27/11/2026): o WhatsApp de hoje fica no ⋯ do cartão.
    fireEvent.click(screen.getByRole("button", { name: "Ações de Maria Nova" }));
    expect(screen.getByRole("menuitem", { name: "Abrir WhatsApp" })).toHaveAttribute("href", "https://wa.me/5521900000101");
  });

  it("mostra totais da coluna e abre a cotação a partir do cartão", () => {
    const onQuote = vi.fn();
    const lead = { ...maria, monthlyValue: "1234.56", livesCount: 2 };
    renderKanban({
      groupedLeads: { new: [lead], in_contact: [], quote_sent: [] },
      commercialValuesEnabled: true,
      onQuote,
    });

    expect(screen.getByText((text) => text.includes("1.234,56") && text.includes("2 vidas"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ações de Maria Nova" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fazer cotação" }));
    expect(onQuote).toHaveBeenCalledWith(lead);
  });

  it("cartão abre o drawer e o ⋯ seleciona para o lote", () => {
    const props = renderKanban();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Maria Nova" }));
    expect(props.onOpen).toHaveBeenCalledWith(maria);
    fireEvent.click(screen.getByRole("button", { name: "Ações de Maria Nova" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Selecionar para o lote" }));
    expect(props.onToggle).toHaveBeenCalledWith("l1");
    fireEvent.click(screen.getByRole("button", { name: "Ações de Carlos Mendes" }));
    expect(screen.getByRole("menuitem", { name: "Tirar da seleção" })).toBeInTheDocument();
    const bar = within(screen.getByRole("toolbar", { name: "Ações em lote" }));
    expect(bar.getByText("1 selecionado")).toBeInTheDocument();
  });

  it("cartão do artifact: ponto da fila, nome e o ⋯ na mesma linha; o ⋯ não abre o lead", () => {
    const props = renderKanban({ groupedLeads: { new: [{ ...maria, queueName: "Fila Tatiana", queueColorHue: 320 }], in_contact: [], quote_sent: [] } });
    const menu = screen.getByRole("button", { name: "Ações de Maria Nova" });
    const line = menu.closest("[class*='kline']")!;
    expect(line).toHaveTextContent("Maria Nova");
    expect(line).toHaveTextContent("Fila Fila Tatiana");
    fireEvent.click(menu);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  it("reordenar pelo teclado usa a mesma regra do arrastar", () => {
    const props = renderKanban();
    const handle = screen.getByRole("button", { name: /Mover coluna Novo/ });
    fireEvent.keyDown(handle, { key: " " });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("button", { name: /Mover coluna Novo/ }), { key: " " });
    expect(props.onMoveColumn).toHaveBeenCalledWith("new", "in_contact");
  });

  it("corretor não vê a data de chegada", () => {
    const { container } = render(<div />);
    renderKanban({ hideArrival: true });
    expect(container.ownerDocument.querySelector("[class*='arrival']")).toBeNull();
  });

  it("link do corretor fica fora de botão (irmão do botão esticado que abre o lead)", () => {
    const { container } = render(<div />);
    const props = renderKanban();
    const link = screen.getByRole("link", { name: "Ver perfil de Ana Souza" });
    expect(link).toHaveAttribute("href", "/equipe/c1");
    expect(link.closest("button")).toBeNull();
    expect(link.closest("[role='button']")).toBeNull();
    expect(container.ownerDocument.querySelector("[role='button']")).toBeNull();
    const open = screen.getByRole("button", { name: "Abrir Carlos Mendes" });
    expect(open.parentElement).toContainElement(link);
    expect(open.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.click(link);
    expect(props.onOpen).not.toHaveBeenCalled();
    fireEvent.click(open);
    expect(props.onOpen).toHaveBeenCalledWith(carlos);
  });

  it("cabeçalho da coluna soma valor e vidas; cartão mostra interesse, corretor e último contato", () => {
    const lead = { ...carlos, monthlyValue: "500", livesCount: 3, lastContactAt: "2026-10-22T15:00:00.000Z" };
    renderKanban({ groupedLeads: { new: [], in_contact: [lead], quote_sent: [] }, commercialValuesEnabled: true });
    const column = screen.getByRole("region", { name: "Em atendimento" });
    expect(within(column).getByText((text) => text.includes("500,00") && text.includes("3 vidas"))).toBeInTheDocument();
    expect(within(column).getByText("PME · 3 vidas")).toBeInTheDocument();
    expect(within(column).getByText("há 2 dias")).toBeInTheDocument();
  });

  it("faixa 'Sem resposta há X' quando passou do SLA de parado", () => {
    const lead = { ...carlos, status: "quote_sent", stageEnteredAt: "2026-10-18T15:00:00.000Z", lastContactAt: "2026-10-19T15:00:00.000Z" };
    renderKanban({ groupedLeads: { new: [], in_contact: [], quote_sent: [lead] } });
    expect(screen.getByText("Sem resposta há 5 dias")).toBeInTheDocument();
  });

  it("⋯ do cartão: próxima etapa pelo fluxo da gestão, com confirmação depois do servidor", async () => {
    const onStageCommitted = vi.fn();
    const lead = { ...carlos, status: "quote_sent" };
    renderKanban({ groupedLeads: { new: [], in_contact: [], quote_sent: [lead] }, stageActor: () => "management", onStageCommitted });
    fireEvent.click(screen.getByRole("button", { name: "Ações de Carlos Mendes" }));
    expect(screen.getByRole("menuitem", { name: "Abrir" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Marcar perdido…" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Próxima etapa: Negociação" }));
    expect(await screen.findByText("Carlos Mendes foi para Negociação.")).toBeInTheDocument();
    const form = actions.bulkChangeLeadStatusAction.mock.calls[0]![1] as FormData;
    expect(form.get("newStatus")).toBe("negotiation");
    expect(onStageCommitted).toHaveBeenCalledWith({ leadIds: ["l2"], newStatus: "negotiation" });
  });

  it("Marcar perdido abre o seletor de motivo", () => {
    renderKanban({ stageActor: () => "owner" });
    fireEvent.click(screen.getByRole("button", { name: "Ações de Carlos Mendes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Marcar perdido…" }));
    expect(screen.getByRole("dialog", { name: "Marcar como perdido" })).toBeInTheDocument();
    expect(screen.getByText("Motivo da perda")).toBeInTheDocument();
  });

  it("sem papel para mover, o ⋯ só abre", () => {
    renderKanban();
    fireEvent.click(screen.getByRole("button", { name: "Ações de Carlos Mendes" }));
    expect(screen.queryByRole("menuitem", { name: /Próxima etapa/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Marcar perdido…" })).toBeNull();
  });
});
