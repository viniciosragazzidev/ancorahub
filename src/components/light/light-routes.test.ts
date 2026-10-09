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
    // The lead is a chat; ?ficha=1 is the full record and goes back to the chat.
    expect(resolveLightRoute("/leads/123").chat).toBe(true);
    const ficha = resolveLightRoute("/leads/123", new URLSearchParams("ficha=1"));
    expect(ficha.chat).toBeFalsy();
    expect(ficha).toMatchObject({ parentHref: "/leads/123", backToParent: true });
    expect(resolveLightRoute("/minha-fila").hidesTabBar).toBeUndefined();
    expect(resolveLightRoute("/clientes")).toMatchObject({ tab: "mais", parentHref: "/dashboard" });
    expect(resolveLightRoute("/clientes/9")).toMatchObject({ parentHref: "/clientes" });
    expect(resolveLightRoute("/algo-desconhecido")).toMatchObject({ isRoot: false, parentHref: "/dashboard" });
  });

  it("shows capability destinations in Mais only when enabled", () => {
    expect(getLightMoreDestinations({}).map((item) => item.href)).toEqual(["/clientes", "/notificacoes", "/settings"]);
    expect(getLightMoreDestinations({ quoteSimulator: true, dutyCalendar: true }).map((item) => item.href))
      .toEqual(["/cotacao", "/plantoes", "/clientes", "/notificacoes", "/settings"]);
  });

  it("gives every Light destination a title, a parent and the right tab", () => {
    const table: Array<[string, { title: string; tab: string; isRoot: boolean; parentHref: string | null }]> = [
      ["/dashboard", { title: "Início", tab: "inicio", isRoot: true, parentHref: null }],
      ["/minha-fila", { title: "Fila", tab: "fila", isRoot: true, parentHref: null }],
      ["/conversas/broker", { title: "Insights", tab: "insights", isRoot: true, parentHref: null }],
      ["/notificacoes", { title: "Notificações", tab: "mais", isRoot: false, parentHref: "/dashboard" }],
      ["/clientes", { title: "Clientes", tab: "mais", isRoot: false, parentHref: "/dashboard" }],
      ["/clientes/abc", { title: "Cliente", tab: "mais", isRoot: false, parentHref: "/clientes" }],
      ["/cotacao", { title: "Cotação", tab: "mais", isRoot: false, parentHref: "/dashboard" }],
      ["/plantoes", { title: "Plantões", tab: "mais", isRoot: false, parentHref: "/dashboard" }],
      ["/settings", { title: "Configurações", tab: "mais", isRoot: false, parentHref: "/dashboard" }],
      ["/primeiro-acesso", { title: "Primeiro acesso", tab: "inicio", isRoot: true, parentHref: null }],
    ];
    for (const [path, expected] of table) expect(resolveLightRoute(path), path).toMatchObject(expected);
  });

  it("opens a conversation as an internal screen that goes back to the Insights list", () => {
    expect(resolveLightRoute("/conversas/broker", new URLSearchParams("leadId=abc"))).toMatchObject({
      title: "Conversa", tab: "insights", isRoot: false, parentHref: "/conversas/broker",
    });
    expect(resolveLightRoute("/conversas/broker", new URLSearchParams("")).isRoot).toBe(true);
  });

  it("sends the feedback form back to its lead and keeps the tab bar", () => {
    const route = resolveLightRoute("/leads/abc/feedback");
    expect(route).toMatchObject({ title: "Atualização", tab: "fila", parentHref: "/leads/abc" });
    expect(route.hidesTabBar).toBeUndefined();
  });

  it("hides the tab bar on the screens that carry their own action bar or no navigation", () => {
    for (const path of ["/leads/abc", "/cotacao", "/primeiro-acesso"]) expect(resolveLightRoute(path).hidesTabBar, path).toBe(true);
  });

  it("opens a settings section as an internal screen that goes back to the list", () => {
    expect(resolveLightRoute("/settings", new URLSearchParams(""))).toMatchObject({ title: "Configurações", parentHref: "/dashboard" });
    expect(resolveLightRoute("/settings", new URLSearchParams("tab=seguranca"))).toMatchObject({
      title: "Segurança", tab: "mais", isRoot: false, parentHref: "/settings", backToParent: true,
    });
    expect(resolveLightRoute("/settings", new URLSearchParams("tab=passkey")).title).toBe("Segurança");
    expect(resolveLightRoute("/settings", new URLSearchParams("tab=disponibilidade")).hidesTabBar).toBe(true);
    expect(resolveLightRoute("/settings", new URLSearchParams("tab=conta")).hidesTabBar).toBeFalsy();
  });
});
