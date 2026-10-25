// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeadsFilters } from "./leads-filters";

// Chave desligada (sem provider): o HTML dos filtros precisa continuar idêntico ao de antes do Lite.
// O snapshot foi gerado com o arquivo original, antes da versão Lite existir.
const params = { current: new URLSearchParams("search=Maria&branch=b1&corretor=c1&tipo=PF&qualification=hot&pageSize=50") };
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => params.current,
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
});

const props = {
  initialSearch: "Maria",
  initialBranch: "b1",
  initialCorretor: "c1",
  initialTipo: "PF",
  initialQualification: "hot",
  initialPageSize: "50",
  storageKey: "teste:filtros",
  branches: [{ id: "b1", name: "Centro" }, { id: "b2", name: "Barra" }],
  brokers: [{ id: "c1", name: "Ana Souza" }],
  tags: [{ id: "t1", name: "VIP", colorHue: 120 }],
};

describe("filtros de /leads com a chave desligada", () => {
  it("preserva o HTML legado sem provider (fechado e com o painel aberto)", async () => {
    const { container } = render(<LeadsFilters {...props} />);
    expect(container.innerHTML).toMatchSnapshot("fechado");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    });
    expect(document.body.innerHTML).toMatchSnapshot("aberto");
  });

  it("remover um chip navega com os demais parâmetros", () => {
    render(<LeadsFilters {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /Remover filtro Filial|Filial: Centro/ }));
    expect(replace).toHaveBeenCalled();
    const target = String(replace.mock.calls.at(-1)?.[0]);
    expect(target).not.toContain("branch=");
    expect(target).toContain("corretor=c1");
  });
});
