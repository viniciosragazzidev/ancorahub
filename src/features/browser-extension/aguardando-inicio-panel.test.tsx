// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AguardandoInicio, type AcoesAguardando } from "../../../apps/browser-extension/src/panel/aguardando-inicio";

const lead = { id: "11111111-1111-4111-8111-111111111111", primeiroNome: "Maria", phoneMasked: "(61) 9****-9999", temperatura: "quente" as const, atribuidoEm: "2026-11-03T18:12:23.000Z" };

function acoes(over: Partial<AcoesAguardando> = {}): AcoesAguardando {
  return {
    carregarAguardando: vi.fn(async () => ({ ok: true as const, leads: [lead] })),
    iniciarLead: vi.fn(async () => ({ ok: true as const, phone: "5561999999999", greeting: "Olá Maria", whatsappUrl: "https://wa.me/5561999999999" })),
    abrirConversa: vi.fn(async () => ({ ok: true as const })),
    abrirReserva: vi.fn(),
    ...over,
  };
}

describe("gaveta: leads aguardando início", () => {
  afterEach(cleanup);

  it("lista o lead atribuído com o botão Iniciar e abrir", async () => {
    render(<AguardandoInicio acoes={acoes()} refreshKey={0} ativa />);
    expect(await screen.findByText("Maria")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar e abrir" })).toBeTruthy();
  });

  it("Iniciar e abrir chama o início do servidor e abre a conversa nativa com a saudação", async () => {
    const a = acoes();
    render(<AguardandoInicio acoes={a} refreshKey={0} ativa />);
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar e abrir" }));
    await waitFor(() => expect(a.abrirConversa).toHaveBeenCalledWith({ phone: "5561999999999", greeting: "Olá Maria" }));
    expect(a.iniciarLead).toHaveBeenCalledWith(lead.id);
    expect(await screen.findByText(/Atendimento iniciado\. Saudação preenchida para Maria/)).toBeTruthy();
  });

  it("falha do início não abre a conversa e mostra a mensagem do servidor", async () => {
    const a = acoes({ iniciarLead: vi.fn(async () => ({ ok: false as const, message: "Este lead já foi assumido ou não está mais disponível." })) });
    render(<AguardandoInicio acoes={a} refreshKey={0} ativa />);
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar e abrir" }));
    expect(await screen.findByText("Este lead já foi assumido ou não está mais disponível.")).toBeTruthy();
    expect(a.abrirConversa).not.toHaveBeenCalled();
  });

  it("sem lead aguardando, mostra o estado vazio e não chama o servidor fechado", async () => {
    const a = acoes({ carregarAguardando: vi.fn(async () => ({ ok: true as const, leads: [] })) });
    render(<AguardandoInicio acoes={a} refreshKey={0} ativa={false} />);
    expect(a.carregarAguardando).not.toHaveBeenCalled();
    expect(screen.getByText(/Buscando leads/)).toBeTruthy();
  });
});
