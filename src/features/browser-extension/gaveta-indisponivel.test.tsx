// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Gaveta, type AcoesGaveta } from "../../../apps/browser-extension/src/panel/gaveta";

const acoes = (): AcoesGaveta => ({
  abrirNoCrm: vi.fn(), respostas: vi.fn(async () => []), inserir: vi.fn(), conectar: vi.fn(), tentarNovamente: vi.fn(), fechar: vi.fn(),
});

describe("gaveta: acesso indisponível", () => {
  afterEach(cleanup);

  it("403 mostra a indisponibilidade e nenhum dado do lead", () => {
    render(<Gaveta estado={{ tipo: "indisponivel" }} acoes={acoes()} />);
    expect(screen.getByRole("status").textContent).toMatch(/não está disponível para a sua conta/);
    expect(screen.queryByText(/Temperatura|Próximo passo|Abrir no CRM/)).toBeNull();
  });
});
