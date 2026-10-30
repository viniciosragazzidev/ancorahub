// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

import { LeadsLiteKanban } from "./leads-lite-kanban";

vi.mock("./status-actions", () => ({
  bulkChangeLeadStatusAction: vi.fn(),
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
  render(<LeadsLiteKanban {...props} />);
  return props;
}

describe("kanban Lite de /leads", () => {
  it("colunas com rótulo em sentence case e cartão com as informações de hoje", () => {
    renderKanban();
    expect(screen.getByRole("heading", { name: "Em atendimento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cotação enviada" })).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Aguardando distribuição")).toBeInTheDocument();
    expect(screen.getAllByText(/restantes|atrasado/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Abrir WhatsApp de Maria Nova" })).toHaveAttribute("href", "https://wa.me/5521900000101");
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
    fireEvent.click(screen.getByRole("button", { name: "Fazer cotação" }));
    expect(onQuote).toHaveBeenCalledWith(lead);
  });

  it("cartão abre o drawer e a caixa seleciona para o lote", () => {
    const props = renderKanban();
    fireEvent.click(screen.getByRole("button", { name: "Maria Nova" }));
    expect(props.onOpen).toHaveBeenCalledWith(maria);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Maria Nova" }));
    expect(props.onOpen).toHaveBeenCalledWith(maria);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Maria Nova" }));
    expect(props.onToggle).toHaveBeenCalledWith("l1");
    expect(screen.getByRole("checkbox", { name: "Selecionar Carlos Mendes" })).toBeChecked();
    const bar = within(screen.getByRole("region", { name: "Ações em lote" }));
    expect(bar.getByText("1 selecionado")).toBeInTheDocument();
  });

  it("a caixa de seleção fica no cabeçalho do cartão, junto da conversa", () => {
    renderKanban();
    const box = screen.getByRole("checkbox", { name: "Selecionar Maria Nova" });
    const whatsapp = screen.getByRole("link", { name: "Abrir WhatsApp de Maria Nova" });
    expect(box.closest("[class*='cardActions']")).toBe(whatsapp.closest("[class*='cardActions']"));
    expect(box.closest("[class*='cardHead']")).toContainElement(screen.getByRole("button", { name: "Maria Nova" }));
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
});
