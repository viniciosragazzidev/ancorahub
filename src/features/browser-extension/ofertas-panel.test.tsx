// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfertasPendentes, type AcoesOfertas } from "../../../apps/browser-extension/src/panel/ofertas";
import type { OfertaExtensao } from "../../../apps/browser-extension/src/shared/types";

const OFERTA: OfertaExtensao = {
  id: "offer-falso-0001",
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  plantao: "Plantão Centro (teste)",
  temperatura: "quente",
  primeiroNome: "Cliente Exemplo",
  phoneMasked: "(11) 9****-0000",
  foraDoPlantao: false,
};

function criarAcoes(overrides: Partial<AcoesOfertas> = {}): AcoesOfertas {
  return {
    carregar: vi.fn(async () => ({ ok: true as const, ofertas: [OFERTA] })),
    aceitar: vi.fn(async () => ({ ok: true as const, phone: "+5511999990000", greeting: "Olá, Cliente Exemplo!", whatsappUrl: "https://web.whatsapp.com/send?phone=5511999990000&text=Ola" })),
    recusar: vi.fn(async () => ({ ok: true as const, alreadyDeclined: false, contaComoPulo: true, message: "Oferta recusada; registrada como pulo do plantão." })),
    abrirConversa: vi.fn(async () => ({ ok: true as const })),
    abrirReserva: vi.fn(),
    lerSom: vi.fn(async () => false),
    definirSom: vi.fn(),
    ...overrides,
  };
}

describe("ofertas pendentes no painel Lite", () => {
  afterEach(cleanup);

  it("explica que recusar conta como pulo e só chama a API após confirmar", async () => {
    const acoes = criarAcoes();
    render(<OfertasPendentes acoes={acoes} refreshKey={0} destacarOfferId={null} ativa={true} />);

    fireEvent.click(await screen.findByRole("button", { name: "Recusar" }));
    expect(screen.getByText("A recusa conta como pulo do plantão.")).toBeTruthy();
    expect(acoes.recusar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    await waitFor(() => expect(acoes.recusar).toHaveBeenCalledWith(OFERTA.id));
    expect(await screen.findByText(/registrada como pulo/)).toBeTruthy();
  });

  it("mantém o aceite após falha ao abrir e oferece tentar de novo ou o link reserva", async () => {
    const acoes = criarAcoes({
      abrirConversa: vi.fn().mockRejectedValueOnce(new Error("WhatsApp ainda está carregando"))
        .mockResolvedValueOnce({ ok: true as const }),
    });
    render(<OfertasPendentes acoes={acoes} refreshKey={0} destacarOfferId={null} ativa={true} />);

    fireEvent.click(await screen.findByRole("button", { name: "Aceitar e abrir" }));
    expect(await screen.findByText("Lead aceito. Não consegui confirmar a conversa no WhatsApp.")).toBeTruthy();
    expect(acoes.aceitar).toHaveBeenCalledWith(OFERTA.id);
    expect(acoes.abrirConversa).toHaveBeenCalledWith({ phone: "+5511999990000", greeting: "Olá, Cliente Exemplo!" });
    expect(screen.getByRole("button", { name: "Tentar abrir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir link reserva" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Enviar$/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir link reserva" }));
    expect(acoes.abrirReserva).toHaveBeenCalledWith("https://web.whatsapp.com/send?phone=5511999990000&text=Ola");

    fireEvent.click(screen.getByRole("button", { name: "Tentar abrir" }));
    await waitFor(() => expect(acoes.abrirConversa).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Saudação preenchida/)).toBeTruthy();
    expect(acoes.abrirReserva).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["expired", "O prazo terminou. Esta oferta não pode mais ser aceita."],
    ["already_assigned", "Este lead já foi atribuído ou deixou de estar disponível."],
    ["outside_duty", "Esta oferta só pode ser aceita durante o plantão indicado."],
  ])("mostra a resposta de negócio %s sem perder o contexto", async (error, message) => {
    const acoes = criarAcoes({ aceitar: vi.fn(async () => ({ ok: false as const, error, message: "resposta do servidor" })) });
    render(<OfertasPendentes acoes={acoes} refreshKey={0} destacarOfferId={null} ativa={true} />);

    fireEvent.click(await screen.findByRole("button", { name: "Aceitar e abrir" }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(acoes.abrirConversa).not.toHaveBeenCalled();
  });

  it("não habilita aceitar fora do plantão e mantém o aviso de pulo explícito", async () => {
    const acoes = criarAcoes({ carregar: vi.fn(async () => ({ ok: true as const, ofertas: [{ ...OFERTA, foraDoPlantao: true }] })) });
    render(<OfertasPendentes acoes={acoes} refreshKey={0} destacarOfferId={null} ativa={true} />);

    expect(await screen.findByRole("button", { name: "Fora do plantão" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    expect(screen.getByText("A recusa conta como pulo do plantão.")).toBeTruthy();
  });
});
