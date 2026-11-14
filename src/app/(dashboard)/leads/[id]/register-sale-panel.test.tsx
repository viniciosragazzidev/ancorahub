// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { registerSaleAction } from "@/features/post-sale/actions";

import { isoDaDataCompleta, RegisterSalePanel } from "./register-sale-panel";

vi.mock("next/navigation", () => {
  const router = { refresh: vi.fn() };
  return { useRouter: () => router };
});
vi.mock("@/components/motion/success-overlay", () => ({ useSuccessOverlay: () => ({ celebrate: vi.fn(), node: null }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/post-sale/actions", () => ({ registerSaleAction: vi.fn() }));

const registerSale = vi.mocked(registerSaleAction);

/**
 * Payload que o campo nativo type="date" de antes produzia para início 2026-02-01, 12 meses, R$ 1.500,00.
 * A máscara dd/mm/aaaa tem que chegar exatamente nele.
 */
const PAYLOAD_ANTIGO = {
  leadId: "lead-1",
  policyNumber: "APO-123",
  coverageStartDate: "2026-02-01",
  contractTermMonths: 12,
  expirationDate: "2027-02-01",
  paymentMethod: "boleto",
  renewalType: "reajuste_operadora",
  renewalContactPreference: "whatsapp",
  postSaleNotes: undefined,
  approvedValue: "1500",
  confirmationDocumentId: "doc-1",
  carrierId: undefined,
};

function digitar(campo: HTMLElement, valor: string, inputType = "insertText") {
  const input = campo as HTMLInputElement;
  input.focus();
  fireEvent.change(input, { target: { value: valor, selectionStart: valor.length }, nativeEvent: { inputType } });
}

function renderPanel() {
  render(
    <RegisterSalePanel
      leadId="lead-1"
      documents={[{ id: "doc-1", filename: "confirmacao.pdf", status: "approved" }]}
      carriers={[]}
      open
      onOpenChange={() => undefined}
    />,
  );
}

async function preencherBase() {
  fireEvent.change(document.getElementById("approved-value")!, { target: { value: "1500,00" } });
  fireEvent.change(document.getElementById("policy-number")!, { target: { value: "APO-123" } });
  fireEvent.click(screen.getByRole("button", { name: /^Confirmação:/ }));
  fireEvent.click(await screen.findByRole("option", { name: /confirmacao\.pdf/ }));
}

async function abrirInicio() {
  fireEvent.click(screen.getByRole("button", { name: /^Início:/ }));
  return (await screen.findByLabelText("Início da vigência")) as HTMLInputElement;
}

async function salvar() {
  const botao = screen.getByRole("button", { name: "Salvar venda" });
  expect(botao).not.toBeDisabled();
  await act(async () => {
    fireEvent.click(botao);
  });
  await waitFor(() => expect(registerSale).toHaveBeenCalledTimes(1));
  return registerSale.mock.calls[0]![0];
}

beforeEach(() => {
  registerSale.mockReset();
  registerSale.mockResolvedValue({ success: true } as never);
});
afterEach(cleanup);

describe("isoDaDataCompleta", () => {
  it("só devolve ISO para dd/mm/aaaa completa e existente", () => {
    expect(isoDaDataCompleta("01/02/2026")).toBe("2026-02-01");
    expect(isoDaDataCompleta("29/02/2028")).toBe("2028-02-29");
    expect(isoDaDataCompleta("01/02/20")).toBe("");
    expect(isoDaDataCompleta("01/02/202")).toBe("");
    expect(isoDaDataCompleta("31/02/2026")).toBe("");
    expect(isoDaDataCompleta("")).toBe("");
  });
});

describe("RegisterSalePanel: máscara de data mantém o payload", () => {
  it("usa teclado numérico e máscara dd/mm/aaaa no início da vigência", async () => {
    renderPanel();
    const inicio = await abrirInicio();
    expect(inicio.type).toBe("text");
    expect(inicio.getAttribute("inputmode")).toBe("numeric");
    digitar(inicio, "01022026");
    expect(inicio.value).toBe("01/02/2026");
  });

  it("dígitos corridos chegam ao servidor como a data ISO do campo nativo", async () => {
    renderPanel();
    await preencherBase();
    digitar(await abrirInicio(), "01022026");
    expect(await salvar()).toEqual(PAYLOAD_ANTIGO);
  });

  it("data ISO colada chega igual", async () => {
    renderPanel();
    await preencherBase();
    digitar(await abrirInicio(), "2026-02-01", "insertFromPaste");
    expect(await salvar()).toEqual(PAYLOAD_ANTIGO);
  });

  it("ano com 2 dígitos vale ao sair do campo", async () => {
    renderPanel();
    await preencherBase();
    const inicio = await abrirInicio();
    digitar(inicio, "1/2/26");
    expect(screen.getByRole("button", { name: "Salvar venda" })).toBeDisabled();
    fireEvent.blur(inicio);
    expect(inicio.value).toBe("01/02/2026");
    expect(await salvar()).toEqual(PAYLOAD_ANTIGO);
  });

  it("data inexistente avisa e não libera o registro", async () => {
    renderPanel();
    await preencherBase();
    const inicio = await abrirInicio();
    digitar(inicio, "31022026");
    expect(screen.getByText("Essa data não existe. Confira o dia e o mês.")).toBeTruthy();
    expect(inicio.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("button", { name: "Salvar venda" })).toBeDisabled();
  });

  it("vencimento editado com máscara vai em ISO; incompleto cai no calculado, como antes", async () => {
    renderPanel();
    await preencherBase();
    const inicio = await abrirInicio();
    digitar(inicio, "01022026");
    fireEvent.click(screen.getByRole("button", { name: "Pronto" }));
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    const vencimento = screen.getByLabelText("Data de vencimento (calculada)") as HTMLInputElement;
    expect(vencimento.value).toBe("01/02/2027");

    digitar(vencimento, "15/03/2");
    fireEvent.blur(vencimento);
    expect(vencimento.value).toBe("01/02/2027");

    digitar(vencimento, "15032027");
    expect(await salvar()).toEqual({ ...PAYLOAD_ANTIGO, expirationDate: "2027-03-15" });
  });

  it("vencimento inexistente trava o registro em vez de mandar o calculado", async () => {
    renderPanel();
    await preencherBase();
    const inicio = await abrirInicio();
    digitar(inicio, "01022026");
    fireEvent.click(screen.getByRole("button", { name: "Pronto" }));
    fireEvent.click(screen.getByRole("button", { name: /Mais opções/ }));
    const vencimento = screen.getByLabelText("Data de vencimento (calculada)") as HTMLInputElement;
    digitar(vencimento, "31022027");
    fireEvent.blur(vencimento);
    expect(vencimento.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("button", { name: "Salvar venda" })).toBeDisabled();
  });
});
