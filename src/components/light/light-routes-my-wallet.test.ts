import { describe, expect, it } from "vitest";

import { resolveLightRoute } from "./light-routes";

describe("título de /clientes no Lite (Minha carteira, etapa 4a)", () => {
  it("corretor com a Minha carteira ligada vê Minha carteira", () => {
    expect(resolveLightRoute("/clientes", null, { brokerMyWallet: true })).toMatchObject({ title: "Minha carteira", parentHref: "/dashboard", tab: "mais" });
    expect(resolveLightRoute("/clientes/", null, { brokerMyWallet: true }).title).toBe("Minha carteira");
  });

  it("sem a opção (chaves desligadas, supervisor ou gestor) continua Clientes", () => {
    expect(resolveLightRoute("/clientes").title).toBe("Clientes");
    expect(resolveLightRoute("/clientes", null, { brokerMyWallet: false }).title).toBe("Clientes");
  });

  it("o perfil do cliente continua com o mesmo título e volta para a carteira", () => {
    expect(resolveLightRoute("/clientes/abc", null, { brokerMyWallet: true })).toMatchObject({ title: "Cliente", parentHref: "/clientes" });
  });
});
