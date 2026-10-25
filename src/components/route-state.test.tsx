// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteError } from "./route-error";
import { RouteNotFound } from "./route-not-found";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("telas de erro no visual Lite para todo mundo", () => {
  it("erro de rota: mesmo título, tenta de novo pelo reset e volta ao início", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reset = vi.fn();
    const { container } = render(<RouteError error={Object.assign(new Error("falhou"), { digest: "d1" })} reset={reset} title="Não foi possível carregar esta operação" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar esta operação");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Voltar para o Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Detalhes técnicos do erro")).toBeInTheDocument();
    expect(container.querySelector("main")?.className).not.toContain("arc-venancor");
  });

  it("página não encontrada: sem escopo Lite fora do diretor (segue o tema) e o mesmo destino de volta", () => {
    const { container } = render(<RouteNotFound title="Registro não encontrado" backUrl="/leads" backText="Voltar para leads" standalone />);
    expect(screen.getByRole("heading", { level: 1, name: "Registro não encontrado" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para leads" })).toHaveAttribute("href", "/leads");
    expect(container.querySelector("main")?.className).not.toContain("arc-venancor");
  });
});
