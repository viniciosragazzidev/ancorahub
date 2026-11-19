// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AllowedLink, UnitManagerLinks } from "./allowed-link";

function links(active: boolean) {
  return render(
    <UnitManagerLinks active={active}>
      <AllowedLink href="/equipe/plantoes">Plantões da unidade</AllowedLink>
      <AllowedLink href="/leads/distribuicao?view=plantao">Card de plantão</AllowedLink>
      <AllowedLink hideWhenBlocked href="/vendas">Vendas</AllowedLink>
    </UnitManagerLinks>,
  );
}

describe("links do Painel para o gestor de unidade", () => {
  afterEach(cleanup);

  it("gestor: rota liberada vira link, bloqueada vira texto ou some", () => {
    links(true);
    expect(screen.getByRole("link", { name: "Plantões da unidade" }).getAttribute("href")).toBe("/equipe/plantoes");
    expect(screen.queryByRole("link", { name: "Card de plantão" })).toBeNull();
    expect(screen.getByText("Card de plantão")).toBeTruthy();
    expect(screen.queryByText("Vendas")).toBeNull();
  });

  it("diretor e demais papéis: todos os links continuam", () => {
    links(false);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });
});
