import { describe, expect, it } from "vitest";

import {
  getLightMoreDestinations,
  isLightRouteAllowed,
  LIGHT_TABS,
  resolveLightRoute,
} from "./light-routes";

describe("Light routes", () => {
  it("keeps the allowed route list used by the dashboard layout", () => {
    for (const path of ["/dashboard", "/minha-fila", "/leads/abc", "/conversas/broker", "/clientes/1", "/l/token", "/settings", "/notificacoes"]) {
      expect(isLightRouteAllowed(path)).toBe(true);
    }
    for (const path of ["/equipe", "/relatorios", "/vendas", "/integrations/whatsapp"]) {
      expect(isLightRouteAllowed(path)).toBe(false);
    }
  });

  it("exposes Início, Fila and Insights as bar tabs", () => {
    expect(LIGHT_TABS.map((tab) => [tab.label, tab.href])).toEqual([
      ["Início", "/dashboard"],
      ["Fila", "/minha-fila"],
      ["Insights", "/conversas/broker"],
    ]);
  });

  it("treats tab roots as first level and everything else as internal with a parent", () => {
    expect(resolveLightRoute("/dashboard")).toMatchObject({ title: "Início", tab: "inicio", isRoot: true, parentHref: null });
    expect(resolveLightRoute("/minha-fila?filter=awaiting")).toMatchObject({ tab: "fila", isRoot: true });
    expect(resolveLightRoute("/conversas/broker")).toMatchObject({ tab: "insights", isRoot: true });
    expect(resolveLightRoute("/leads/123")).toMatchObject({ title: "Lead", tab: "fila", isRoot: false, parentHref: "/minha-fila" });
    expect(resolveLightRoute("/leads/123").hidesTabBar).toBe(true);
    expect(resolveLightRoute("/minha-fila").hidesTabBar).toBeUndefined();
    expect(resolveLightRoute("/clientes")).toMatchObject({ tab: "mais", parentHref: "/dashboard" });
    expect(resolveLightRoute("/clientes/9")).toMatchObject({ parentHref: "/clientes" });
    expect(resolveLightRoute("/algo-desconhecido")).toMatchObject({ isRoot: false, parentHref: "/dashboard" });
  });

  it("shows capability destinations in Mais only when enabled", () => {
    expect(getLightMoreDestinations({}).map((item) => item.href)).toEqual(["/clientes", "/settings"]);
    expect(getLightMoreDestinations({ quoteSimulator: true, dutyCalendar: true }).map((item) => item.href))
      .toEqual(["/cotacao", "/plantoes", "/clientes", "/settings"]);
  });
});
