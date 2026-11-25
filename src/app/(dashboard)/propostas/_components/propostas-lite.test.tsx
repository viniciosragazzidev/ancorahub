// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PROPOSAL_FIXTURES, PROPOSAL_LEADS } from "./proposals-fixtures";
import { PropostasLite } from "./propostas-lite";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  createProposalAction: vi.fn(async () => ({ success: true, proposalId: "new" })),
  updateProposalStatusAction: vi.fn(async () => ({ success: true })),
  convertProposalToSaleAction: vi.fn(async () => ({ success: true, saleId: "s" })),
  getQuotesForLeadAction: vi.fn(async () => ({ success: true, quotes: [{ id: "q1", title: "Cotação Amil", totalMonthly: "100" }], docs: [] })),
  sendProposalWhatsAppAction: vi.fn(async (): Promise<unknown> => ({ success: true, status: "enviada", link: "https://crm.test/api/quotes/tok-6/pdf" })),
}));
vi.mock("@/features/proposals/actions", () => actions);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const expiring = PROPOSAL_FIXTURES.slice(0, 2);
const table = () => document.querySelector('[role="tabpanel"]:not([hidden]) [data-lite="table"]') as HTMLElement ?? (document.querySelector('[data-lite="table"]') as HTMLElement);

describe("propostas Lite", () => {
  it("mostra os números de hoje e os estados em sentence case", () => {
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} />);
    expect(screen.getByText("Abertas", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Todas/ })).toHaveTextContent("9");
    expect(screen.getByRole("tab", { name: /Abertas/ })).toHaveTextContent("5");
    expect(screen.getByRole("tab", { name: /Expirando/ })).toHaveTextContent("2");
    expect(within(table()).getAllByText("Em revisão").length).toBeGreaterThan(0);
    expect(within(table()).getByText("Venda fechada")).toBeInTheDocument();
  });

  it("copia o link público e troca o status pela mesma ação", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} />);
    await act(async () => {
      fireEvent.click(within(table()).getByRole("button", { name: "Copiar link público de Hapvida Mix individual" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/api/quotes/tok-6/pdf"));
    expect(screen.getByRole("status")).toHaveTextContent("Link de Hapvida Mix individual copiado");
    expect(fire).not.toHaveBeenCalled();
    fireEvent.click(within(table()).getByRole("button", { name: /^Status de Hapvida Mix individual/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "Enviada" }));
    });
    expect(actions.updateProposalStatusAction).toHaveBeenCalledWith("prop-6", "enviada");
    expect(screen.getByRole("status")).toHaveTextContent("Hapvida Mix individual: Enviada");
    expect(fire).toHaveBeenCalledWith("confirm");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("criar proposta e fechar venda abrem no painel lateral com as mesmas ações", async () => {
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} />);
    fireEvent.click(screen.getByRole("button", { name: "Criar proposta" }));
    const panel = screen.getByRole("dialog", { name: "Criar proposta comercial" });
    fireEvent.click(within(panel).getByRole("button", { name: /^Lead correspondente/ }));
    await act(async () => {
      fireEvent.click(within(panel).getByRole("option", { name: "Ana" }));
    });
    expect(actions.getQuotesForLeadAction).toHaveBeenCalledWith("lead-6");
    expect(within(panel).getByRole("button", { name: /^Cotação de origem/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });

    fireEvent.click(within(table()).getAllByRole("button", { name: "Fechar venda" })[0]!);
    const convert = screen.getByRole("dialog", { name: "Fechar venda da proposta" });
    await act(async () => {
      fireEvent.click(within(convert).getByRole("button", { name: "Confirmar venda" }));
    });
    expect(within(convert).getByRole("alert")).toHaveTextContent("Informe o número da apólice e a data de vigência.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(actions.convertProposalToSaleAction).not.toHaveBeenCalled();
  });

  it("fechar venda que falha mostra a causa no painel e Tentar de novo", async () => {
    actions.convertProposalToSaleAction.mockResolvedValueOnce({ success: false, error: "Esta proposta já virou venda." } as never);
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} />);
    fireEvent.click(within(table()).getAllByRole("button", { name: "Fechar venda" })[0]!);
    const convert = screen.getByRole("dialog", { name: "Fechar venda da proposta" });
    fireEvent.change(within(convert).getByRole("textbox", { name: /apólice/ }), { target: { value: "123" } });
    fireEvent.change(convert.querySelector('input[type="date"]')!, { target: { value: "2026-12-01" } });
    await act(async () => {
      fireEvent.click(within(convert).getByRole("button", { name: "Confirmar venda" }));
    });
    expect(within(convert).getByRole("alert")).toHaveTextContent("Esta proposta já virou venda. A proposta continua aprovada.");
    expect(fire).toHaveBeenCalledWith("error");
    await act(async () => {
      fireEvent.click(within(convert).getByRole("button", { name: "Tentar de novo" }));
    });
    expect(actions.convertProposalToSaleAction).toHaveBeenCalledTimes(2);
    expect(fire).toHaveBeenCalledWith("confirm", { sound: true });
    expect(screen.getByRole("status")).toHaveTextContent("venda registrada");
  });

  // 29/10/2026: Unimed está em revisão, Porto e Hapvida expiram em até 3 dias.
  const NOW = Date.UTC(2026, 9, 29, 12);

  it("o que pede ação vem primeiro, com o resumo no topo", () => {
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} now={NOW} />);
    expect(screen.getByTestId("proposals-attention")).toHaveTextContent("1 em revisão e 3 expiram esta semana");
    const titles = within(table()).getAllByRole("row").slice(1, 4).map((row) => row.textContent ?? "");
    expect(titles[0]).toContain("Unimed Rio Pleno adesão");
    expect(titles[1]).toContain("Porto Seguro Saúde 400");
    expect(titles[2]).toContain("Hapvida Mix individual");
    expect(within(table()).getAllByText("Expira em até 3 dias")).toHaveLength(2);
  });

  it("Enviar no WhatsApp manda pelo servidor e só então marca como enviada", async () => {
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} now={NOW} />);
    // Só rascunho e enviada têm a ação.
    expect(within(table()).queryByRole("button", { name: "Enviar Unimed Rio Pleno adesão no WhatsApp" })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(table()).getByRole("button", { name: "Enviar Hapvida Mix individual no WhatsApp" }));
    });
    expect(actions.sendProposalWhatsAppAction).toHaveBeenCalledWith("prop-6");
    expect(fire).toHaveBeenCalledWith("tap");
    expect(fire).toHaveBeenCalledWith("confirm", expect.objectContaining({ sound: true }));
    const row = within(table()).getAllByRole("row").find((item) => item.textContent?.includes("Hapvida Mix individual"))!;
    expect(within(row).getByRole("button", { name: /^Status de Hapvida Mix individual/ })).toHaveTextContent("Enviada");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("sem canal mostra a causa e oferece Copiar link", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    actions.sendProposalWhatsAppAction.mockResolvedValueOnce({ success: false, reason: "no_channel", error: "Conecte o WhatsApp e aguarde o status Conectado.", link: "https://crm.test/api/quotes/tok-6/pdf" });
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} now={NOW} />);
    await act(async () => {
      fireEvent.click(within(table()).getByRole("button", { name: "Enviar Hapvida Mix individual no WhatsApp" }));
    });
    expect(await within(table()).findByText("Conecte o WhatsApp e aguarde o status Conectado. A proposta continua como estava.")).toBeInTheDocument();
    expect(fire).toHaveBeenCalledWith("error");
    await act(async () => {
      fireEvent.click(within(table()).getByRole("button", { name: "Copiar link" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://crm.test/api/quotes/tok-6/pdf");
    const row = within(table()).getAllByRole("row").find((item) => item.textContent?.includes("Hapvida Mix individual"))!;
    expect(within(row).getByRole("button", { name: /^Status de Hapvida Mix individual/ })).toHaveTextContent("Rascunho");
  });

  it("criar proposta já vem com a validade e as condições padrão da corretora", () => {
    render(<PropostasLite initialProposals={PROPOSAL_FIXTURES} expiringProposals={expiring} leads={PROPOSAL_LEADS} now={NOW} defaults={{ validDays: 15, conditions: "Carência conforme contrato." }} />);
    fireEvent.click(screen.getByRole("button", { name: "Criar proposta" }));
    const panel = screen.getByRole("dialog", { name: "Criar proposta comercial" });
    expect(panel.querySelector<HTMLInputElement>('input[name="validUntil"]')!.value).toBe("2026-11-13");
    expect(panel.querySelector<HTMLTextAreaElement>('textarea[name="notes"]')!.value).toBe("Carência conforme contrato.");
    expect(within(panel).getByText("Padrão da corretora: 15 dias.")).toBeInTheDocument();
  });
});
