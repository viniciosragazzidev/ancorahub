import { describe, expect, it } from "vitest";

import { getLightMoreDestinations, isLightRouteAllowed, resolveLightRoute } from "./light-routes";

describe("supervisor Lite routes", () => {
  it("allows the team screens route by route", () => {
    for (const path of ["/dashboard", "/dashboard/c/equipe", "/leads", "/leads/abc", "/clientes", "/equipe", "/equipe/u1", "/equipe/transferencia", "/relacionamento", "/notificacoes", "/settings"]) {
      expect(isLightRouteAllowed(path, "supervisor")).toBe(true);
    }
  });

  it("never lets normal management screens or the broker's own work in", () => {
    for (const path of ["/leads/distribuicao", "/leads/distribuicao/plantao/x", "/dashboard/relatorios", "/equipe/cargos", "/equipe/dashboard", "/minha-fila", "/cotacao", "/plantoes", "/conversas/broker"]) {
      expect(isLightRouteAllowed(path, "supervisor")).toBe(false);
    }
    // The broker keeps its own list.
    expect(isLightRouteAllowed("/minha-fila")).toBe(true);
  });

  it("gives the supervisor their own Mais menu", () => {
    expect(getLightMoreDestinations({ relationshipCenter: true }, "supervisor").map((item) => item.href)).toEqual(["/equipe", "/equipe/transferencia", "/relacionamento", "/clientes", "/notificacoes", "/settings"]);
  });

  it("sets the transfer page title and parent", () => {
    expect(resolveLightRoute("/equipe/transferencia")).toMatchObject({ title: "Pedir transferência", parentHref: "/equipe", tab: "mais" });
  });
});
