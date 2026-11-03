// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Gaveta, type AcoesGaveta } from "../../../apps/browser-extension/src/panel/gaveta";

const acoes = (): AcoesGaveta => ({
  carregar: vi.fn(async () => ({ ok: true as const, ofertas: [] })), aceitar: vi.fn(async () => ({ ok: false as const, error: "OFFLINE", message: "indisponível" })),
  recusar: vi.fn(async () => ({ ok: false as const, error: "OFFLINE", message: "indisponível" })), abrirConversa: vi.fn(async () => ({ ok: false as const, reason: "NOT_READY" })),
  abrirReserva: vi.fn(), lerSom: vi.fn(async () => false), definirSom: vi.fn(), abrirNotificacoes: vi.fn(),
  abrirNoCrm: vi.fn(), respostas: vi.fn(async () => []), inserir: vi.fn(), acao: vi.fn(async () => ({ ok: true as const })), conectar: vi.fn(), tentarNovamente: vi.fn(), fechar: vi.fn(),
});

describe("gaveta: acesso indisponível", () => {
  afterEach(cleanup);

  it("403 mostra a indisponibilidade e nenhum dado do lead", () => {
    render(<Gaveta estado={{ tipo: "indisponivel" }} acoes={acoes()} />);
    expect(screen.getByText(/A extensão não está disponível para a sua conta/)).toBeTruthy();
    expect(screen.queryByText(/Temperatura|Próximo passo|Abrir no CRM/)).toBeNull();
  });
});
