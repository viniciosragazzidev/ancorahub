// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// As ações rápidas chamam Server Actions existentes; aqui só interessa que sejam chamadas com os dados certos.
const actions = vi.hoisted(() => ({
  addLeadNoteAction: vi.fn(async () => ({ success: true })),
  createLeadTaskAction: vi.fn(async () => ({ success: true })),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: actions.refresh }) }));
vi.mock("@/features/leads/actions", () => ({ addLeadNoteAction: actions.addLeadNoteAction }));
vi.mock("@/features/leads/task-actions", () => ({ createLeadTaskAction: actions.createLeadTaskAction, setLeadTaskDoneAction: vi.fn() }));
vi.mock("@/features/carteira/retorno-actions", () => ({ agendarRetornoAction: vi.fn(), reagendarRetornoAction: vi.fn() }));

import { buildProfileSummary, buildProfileTimeline, type BrokerClientProfileData } from "@/features/broker-workspace/client-profile/profile-core";

import { BrokerClientProfile } from "./broker-client-profile";

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const sales = [{ id: "v1", planName: "Essencial", carrierName: "Operadora X", saleValue: "350.5", policyNumber: "APL-9", status: "active", saleDate: "2026-11-11", brokerName: "Paulo Dias" }];
const activeCustomer = { status: "active", coverageStartDate: "2026-09-20", contractAnniversary: "2027-09-20", expirationDate: null, renewalStatus: "pending_window", cancellationDate: null, cancellationReason: null };
const entries = buildProfileTimeline({
  interactions: [
    { id: "n1", tipo: "note", conteudo: "Cliente pediu segunda via do boleto", userName: "Paulo Dias", createdAt: "2026-11-10T13:00:00Z" },
    { id: "s1", tipo: "status_change", conteudo: "Etapa: Venda", userName: "Sistema", createdAt: "2026-11-09T13:00:00Z" },
    { id: "w1", tipo: "whatsapp_msg", conteudo: `${"conversa longa ".repeat(40)}fim da conversa`, userName: "Paulo Dias", createdAt: "2026-11-08T13:00:00Z" },
  ],
  sales,
  activeCustomer,
});

function profile(overrides: Partial<BrokerClientProfileData> = {}): BrokerClientProfileData {
  const base: BrokerClientProfileData = {
    client: { id: "c1", leadId: "11111111-1111-4111-8111-111111111111", name: "Marina Alves", phone: "11999998888", email: null, convertedAt: "2026-09-20T12:00:00Z", branchName: "Unidade Centro", brokerName: "Paulo Dias" },
    avatarSrc: null,
    situation: { label: "Cliente ativo", tone: "accent" },
    origin: "Meta Ads",
    canAct: true,
    readOnlyReason: null,
    history: { status: "ok", entries },
    sales,
    activeCustomer,
    documents: [{ id: "d1", filename: "rg.pdf", status: "pending", requirementName: "RG" }],
    beneficiaries: [{ id: "b1", name: "Marina Alves", relationship: "titular", isHolder: true }],
    summary: buildProfileSummary({ timeline: entries, nextAction: { state: "none", taskId: null, title: null, dueAt: null, reason: "Nenhum retorno agendado para este cliente." }, sales, activeCustomer, documents: [{ id: "d1", filename: "rg.pdf", status: "pending", requirementName: "RG" }], renewalAttention: false }),
  };
  return { ...base, ...overrides };
}

describe("Perfil do cliente do corretor", () => {
  it("mostra cabeçalho, ações rápidas, resumo e Histórico como visão inicial", () => {
    render(<BrokerClientProfile data={profile()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Marina Alves" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Marina Alves" })).toHaveTextContent("MA");
    expect(screen.getByText("Cliente ativo")).toBeInTheDocument();
    expect(screen.getByText("Origem: Meta Ads")).toBeInTheDocument();
    expect(screen.getByText("Responsável: Paulo Dias")).toBeInTheDocument();
    for (const name of ["Contato", "Registrar atendimento", "Agendar retorno"]) expect(screen.getByRole("button", { name })).toBeEnabled();
    const summary = screen.getByRole("complementary", { name: "Resumo" });
    expect(within(summary).getByText("Observação")).toBeInTheDocument();
    expect(within(summary).getByText("Nenhum retorno agendado para este cliente.")).toBeInTheDocument();
    expect(within(summary).getByText("1 documento aguardando revisão.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Histórico" })).toBeInTheDocument();
    expect(screen.getByText("Cliente pediu segunda via do boleto")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("em dia");
    expect(document.body.textContent).not.toContain("—");
  });

  it("navega pelas abas Sobre, Contratos e Documentos", () => {
    render(<BrokerClientProfile data={profile()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sobre" }));
    expect(screen.getByRole("heading", { name: "Contato" })).toBeInTheDocument();
    expect(screen.getByText("Unidade Centro")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Contratos" }));
    expect(screen.getByRole("heading", { name: "Vendas (1)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver venda" })).toHaveAttribute("href", "/vendas/v1");
    fireEvent.click(screen.getByRole("button", { name: "Documentos" }));
    expect(screen.getByText("rg.pdf")).toBeInTheDocument();
  });

  it("filtra a linha do tempo, discreto para eventos automáticos e resumo para conversa longa", () => {
    render(<BrokerClientProfile data={profile()} />);
    expect(screen.getByText("Mudança de etapa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver tudo" })).toHaveAttribute("aria-expanded", "false");
    expect(document.body.textContent).not.toContain("fim da conversa");
    fireEvent.click(screen.getByRole("button", { name: "Ver tudo" }));
    expect(document.body.textContent).toContain("fim da conversa");

    fireEvent.click(screen.getByRole("button", { name: /Observações 1/ }));
    const list = screen.getByRole("list", { name: "Histórico: Observações" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(within(list).getByText("Cliente pediu segunda via do boleto")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Documentos 0/ }));
    expect(screen.getByText("Nenhum documento no histórico.")).toBeInTheDocument();
  });

  it("abre na aba e no filtro vindos da URL", () => {
    render(<BrokerClientProfile data={profile()} initialTab="contratos" />);
    expect(screen.getByRole("heading", { name: "Contrato" })).toBeInTheDocument();
  });

  it("registra atendimento pela action de nota existente", async () => {
    render(<BrokerClientProfile data={profile()} />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar atendimento" }));
    fireEvent.change(await screen.findByLabelText("O que foi conversado"), { target: { value: "Ligou para tirar dúvida" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar no histórico" }));
    await vi.waitFor(() => expect(actions.addLeadNoteAction).toHaveBeenCalledTimes(1));
    const form = (actions.addLeadNoteAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(form.get("leadId")).toBe("11111111-1111-4111-8111-111111111111");
    expect(form.get("content")).toBe("Ligou para tirar dúvida");
    await vi.waitFor(() => expect(actions.refresh).toHaveBeenCalled());
  });

  it("fora da carteira fica só de leitura, com o motivo", () => {
    render(<BrokerClientProfile data={profile({ canAct: false, readOnlyReason: "Este cliente não está mais na sua carteira. O perfil fica só para consulta." })} />);
    expect(screen.getByRole("button", { name: "Registrar atendimento" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agendar retorno" })).toBeDisabled();
    expect(screen.getByText(/não está mais na sua carteira/)).toBeInTheDocument();
  });

  it("estados de erro e sem permissão do histórico não fingem histórico vazio", () => {
    const { unmount } = render(<BrokerClientProfile data={profile({ history: { status: "error" } })} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar o histórico agora.");
    expect(screen.getByText("Histórico indisponível agora.")).toBeInTheDocument();
    unmount();
    render(<BrokerClientProfile data={profile({ history: { status: "forbidden" } })} />);
    expect(screen.getByRole("note")).toHaveTextContent("Você não tem permissão para ver o histórico");
  });
});
