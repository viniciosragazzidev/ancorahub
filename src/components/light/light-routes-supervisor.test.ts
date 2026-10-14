import { describe, expect, it } from "vitest";

import { getLightMoreDestinations, isLightRouteAllowed, resolveLightRoute } from "./light-routes";

describe("supervisor Lite routes", () => {
  it("allows the team screens route by route", () => {
    for (const path of ["/dashboard", "/dashboard/c/equipe", "/leads", "/leads/abc", "/clientes", "/equipe", "/equipe/minha", "/equipe/minha/configurar", "/equipe/desempenho", "/equipe/u1", "/equipe/transferencia", "/relacionamento", "/notificacoes", "/settings"]) {
      expect(isLightRouteAllowed(path, "supervisor")).toBe(true);
    }
  });

  it("never lets normal management screens or the broker's own work in", () => {
    for (const path of ["/leads/dashboard", "/leads/arquivados", "/leads/distribuicao", "/leads/distribuicao/plantao/x", "/dashboard/relatorios", "/equipe/cargos", "/equipe/dashboard", "/minha-fila", "/cotacao", "/plantoes", "/conversas/broker"]) {
      expect(isLightRouteAllowed(path, "supervisor")).toBe(false);
    }
    expect(isLightRouteAllowed("/leads/dashboard")).toBe(true);
    // The broker keeps its own list.
    expect(isLightRouteAllowed("/minha-fila")).toBe(true);
  });

  it("gives the supervisor their own Mais menu", () => {
    expect(getLightMoreDestinations({ relationshipCenter: true }, "supervisor").map((item) => item.href)).toEqual(["/equipe/minha", "/equipe/transferencia", "/relacionamento", "/clientes", "/mensagens", "/notificacoes", "/settings"]);
    expect(isLightRouteAllowed("/mensagens", "supervisor")).toBe(true);
    expect(isLightRouteAllowed("/mensagens/lead-1", "supervisor")).toBe(true);
    expect(resolveLightRoute("/mensagens/lead-1")).toMatchObject({ title: "Conversa", parentHref: "/mensagens" });
    expect(getLightMoreDestinations({ relationshipCenter: true, teamRanking: true }, "supervisor").map((item) => item.href)).toContain("/equipe/desempenho");
    expect(getLightMoreDestinations({ relationshipCenter: true, teamRanking: false }, "supervisor").map((item) => item.href)).not.toContain("/equipe/desempenho");
  });

  it("sets the own team page title and parent", () => {
    expect(resolveLightRoute("/equipe/minha")).toMatchObject({ title: "Minha equipe", parentHref: "/dashboard", tab: "mais" });
    expect(resolveLightRoute("/equipe/minha/configurar")).toMatchObject({ title: "Configuração da equipe", parentHref: "/equipe/minha" });
  });

  it("sets the transfer page title and parent", () => {
    expect(resolveLightRoute("/equipe/transferencia")).toMatchObject({ title: "Pedir transferência", parentHref: "/equipe", tab: "mais" });
  });

  it("gives the team board a direct Lite destination", () => {
    expect(resolveLightRoute("/equipe/desempenho")).toMatchObject({ title: "Placar da equipe", parentHref: "/equipe/minha", tab: "mais" });
  });
});
