// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/broker-profile-link", () => ({ BrokerProfileLink: ({ name }: { name: string }) => <span>{name}</span> }));
const actions = vi.hoisted(() => ({
  createPostSaleCampaignAction: vi.fn(),
  getPostSaleWorkspaceAction: vi.fn(),
  markPostSaleAlertHandledAction: vi.fn(),
  previewPostSaleAudienceAction: vi.fn(),
  retryFailedPostSaleCampaignAction: vi.fn(),
  startPostSaleCampaignAction: vi.fn(),
  savePostSaleAutoRuleAction: vi.fn(),
  previewPostSaleAutoRuleAction: vi.fn(),
  savePostSaleR0SettingsAction: vi.fn(),
  savePostSaleHandoffSettingsAction: vi.fn(),
  getPostSaleSurveyMessagesAction: vi.fn(),
  resumePostSaleSurveyAction: vi.fn(),
  previewPostSaleTodayAction: vi.fn(),
  forcePostSaleAutoRuleAction: vi.fn(),
}));
vi.mock("@/features/post-sale-audit/actions", () => actions);

import { AUTO_RULE_KEYS, defaultAutoRuleSettings } from "@/features/post-sale-audit/auto-rules";
import { PostSaleWorkspace } from "./post-sale-workspace";
import { parsePostSaleTab, postSaleTabHref } from "./post-sale-tabs";

type WorkspaceData = Parameters<typeof PostSaleWorkspace>[0]["initialData"];

const NOW = new Date().toISOString();

function survey(overrides: Partial<WorkspaceData["surveys"][number]>): WorkspaceData["surveys"][number] {
  return { id: "s", leadId: `lead-${overrides.id ?? "s"}`, leadName: "Lead", brokerId: "broker-1", brokerName: "Ana", campaignId: "c1", campaignName: "R1", ruleKey: "R1", status: "sent", outcome: null, rating: null, answers: {}, skipReason: null, createdAt: NOW, sentAt: NOW, deliveredAt: null, readAt: null, lastReplyAt: null, completedAt: null, alertOpen: false, ...overrides };
}

function data(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  return {
    brokers: [{ id: "broker-1", name: "Ana" }],
    queues: [{ id: "queue-1", name: "FILA TATIANA" }],
    branches: [],
    campaigns: [],
    surveys: [
      survey({ id: "s1", leadName: "Maria", status: "completed", rating: 5, answers: { contacted: true }, lastReplyAt: NOW, readAt: NOW, deliveredAt: NOW }),
      survey({ id: "s2", leadName: "João", status: "answering", rating: 3, answers: { contacted: false }, lastReplyAt: NOW, deliveredAt: NOW }),
      survey({ id: "s3", leadName: "Clara", status: "sent", deliveredAt: NOW }),
      survey({ id: "s4", leadName: "Pedro", status: "no_reply" }),
      survey({ id: "s5", leadName: "Rita", status: "failed", sentAt: null, skipReason: "falha ao enfileirar o canal de origem" }),
    ],
    alerts: [],
    periodDays: 30,
    r0: { enabled: false, queueIds: [], canEdit: true },
    handoff: { enabled: false, canEdit: true },
    ruleFilter: "all",
    autoRules: { ready: true, canEdit: true, rules: AUTO_RULE_KEYS.map((key) => defaultAutoRuleSettings(key)), tenantDailyLimit: 150 },
    ...overrides,
  } as WorkspaceData;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/equipe/pos-venda?period=30");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("abas do pós-venda", () => {
  it("lê e escreve ?aba= sem perder os outros parâmetros", () => {
    expect(parsePostSaleTab(undefined)).toBe("visao-geral");
    expect(parsePostSaleTab("automacoes")).toBe("automacoes");
    expect(parsePostSaleTab("qualquer")).toBe("visao-geral");
    expect(parsePostSaleTab(undefined, true)).toBe("campanhas");
    expect(postSaleTabHref("?period=7&aba=respostas", "automacoes")).toBe("/equipe/pos-venda?period=7&aba=automacoes");
    expect(postSaleTabHref("?period=7&aba=respostas", "visao-geral")).toBe("/equipe/pos-venda?period=7");
  });

  it("abre na Visão geral com os números do período e troca de aba atualizando a URL", () => {
    render(<PostSaleWorkspace initialData={data()} />);
    const summary = screen.getByLabelText("Resumo do período");
    expect(within(summary).getByText("Enviadas").nextSibling?.textContent).toBe("4");
    expect(within(summary).getByText("Entregues").nextSibling?.textContent).toBe("3");
    expect(within(summary).getByText("Respondidas").nextSibling?.textContent).toBe("2");
    expect(within(summary).getByText("Sem resposta").nextSibling?.textContent).toBe("2");
    expect(within(summary).getByText("Nota média").nextSibling?.textContent).toBe("4/5");
    expect(screen.getByText(/1 pesquisa não saiu/)).toBeVisible();
    expect(screen.getByRole("tab", { name: /Visão geral/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("tab", { name: /Automações/ }));
    expect(screen.getByRole("tab", { name: /Automações/ })).toHaveAttribute("aria-selected", "true");
    expect(window.location.search).toBe("?period=30&aba=automacoes");
    expect(screen.getByRole("heading", { name: "R1 · Checagem de atendimento" })).toBeVisible();

    fireEvent.click(screen.getByRole("tab", { name: /Visão geral/ }));
    expect(window.location.search).toBe("?period=30");
  });

  it("clicar numa regra leva para os leads filtrados", () => {
    render(<PostSaleWorkspace initialData={data()} />);
    fireEvent.click(screen.getByRole("button", { name: /R1 Checagem de atendimento: 2 responderam de 4 enviadas/ }));
    expect(screen.getByRole("tab", { name: /Leads/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/5 de 5 pesquisas/)).toBeVisible();
  });

  it("corretor abre o painel com os leads dele e o lead abre a conversa", async () => {
    actions.getPostSaleSurveyMessagesAction.mockResolvedValue({ ok: true, data: [{ id: "m1", direction: "in", body: "Fui bem atendida", sentAt: NOW, fromAssistant: false }] });
    render(<PostSaleWorkspace initialData={data()} initialTab="corretores" />);
    fireEvent.click(screen.getAllByText("Ana")[0]!);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Leads (5)")).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: /Maria/ }));
    expect(await within(screen.getByRole("dialog")).findByText("Fui bem atendida")).toBeVisible();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Voltar para Ana" })).toBeVisible();
  });

  it("link antigo ?aba=respostas abre Leads só com quem respondeu", () => {
    expect(parsePostSaleTab("respostas")).toBe("leads");
    render(<PostSaleWorkspace initialData={data()} initialTab="leads" initialRespondedOnly />);
    expect(screen.getByText(/2 de 5 pesquisas/)).toBeVisible();
  });

  it("abre direto na aba pedida", () => {
    render(<PostSaleWorkspace initialData={data()} initialTab="campanhas" />);
    expect(screen.getByRole("tab", { name: /Campanhas/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Nova campanha")).toBeVisible();
  });
});

describe("régua automática: a chave salva na hora", () => {
  it("ligar a R1 grava com os padrões, mostra a mensagem e atualiza o contador", async () => {
    actions.savePostSaleAutoRuleAction.mockImplementation(async (input: { key: "R1"; enabled: boolean }) => ({ ok: true, data: { ...defaultAutoRuleSettings("R1"), enabled: input.enabled, updatedAt: "2026-11-09T12:00:00.000Z" } }));
    render(<PostSaleWorkspace initialData={data()} initialTab="automacoes" />);

    const toggle = screen.getByRole("switch", { name: "Ligar a regra R1" });
    await act(async () => { fireEvent.click(toggle); });

    expect(actions.savePostSaleAutoRuleAction).toHaveBeenCalledWith({
      key: "R1",
      enabled: true,
      delayBusinessDays: 1,
      dailyLimit: 60,
      filters: { queueIds: [], branchIds: [], leadTypes: [] },
      pilot: { queueIds: [], brokerIds: [] },
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Regra R1 ligada. Sem piloto: vale para todas as filas, até 60 por dia."));
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("tab", { name: /Automações/ })).toHaveTextContent("1 ligada");
  });

  it("erro do servidor volta a chave e mostra o motivo", async () => {
    actions.savePostSaleAutoRuleAction.mockResolvedValue({ ok: false, error: "Não foi possível concluir a operação agora." });
    render(<PostSaleWorkspace initialData={data()} initialTab="automacoes" />);

    const toggle = screen.getByRole("switch", { name: "Ligar a regra R2" });
    await act(async () => { fireEvent.click(toggle); });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não salvou: Não foi possível concluir a operação agora."));
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("R0 sem fila não liga: abre os ajustes e pede uma fila", async () => {
    render(<PostSaleWorkspace initialData={data()} initialTab="automacoes" />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Ligar a regra do cliente que voltou a escrever" })); });
    expect(actions.savePostSaleR0SettingsAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Escolha pelo menos uma fila do piloto");
    expect(screen.getByText("Filas do piloto (obrigatório para ligar)")).toBeVisible();
  });

  it("diretor liga a troca de corretor sem contato e a chave só muda depois do servidor", async () => {
    actions.savePostSaleHandoffSettingsAction.mockResolvedValue({ ok: true, data: { enabled: true } });
    render(<PostSaleWorkspace initialData={data()} initialTab="automacoes" />);
    const toggle = screen.getByRole("switch", { name: "Ligar a troca automática de corretor" });
    await act(async () => { fireEvent.click(toggle); });
    expect(actions.savePostSaleHandoffSettingsAction).toHaveBeenCalledWith({ enabled: true });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Troca automática ligada."));
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("troca de corretor: erro do servidor volta a chave", async () => {
    actions.savePostSaleHandoffSettingsAction.mockResolvedValue({ ok: false, error: "Apenas diretores podem ligar a troca automática de corretor." });
    render(<PostSaleWorkspace initialData={data()} initialTab="automacoes" />);
    const toggle = screen.getByRole("switch", { name: "Ligar a troca automática de corretor" });
    await act(async () => { fireEvent.click(toggle); });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não salvou: Apenas diretores"));
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("gestor vê as regras sem poder mudar", () => {
    render(<PostSaleWorkspace initialData={data({ r0: { enabled: false, queueIds: [], canEdit: false }, handoff: { enabled: false, canEdit: false }, autoRules: { ready: true, canEdit: false, rules: AUTO_RULE_KEYS.map((key) => defaultAutoRuleSettings(key)), tenantDailyLimit: 150 } })} initialTab="automacoes" />);
    for (const toggle of screen.getAllByRole("switch")) expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Só a direção pode alterar as automações.")).toBeVisible();
  });
});
