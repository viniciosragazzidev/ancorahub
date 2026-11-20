import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

import { DIRECTOR_LITE_OPT_OUT_ROUTES, isDirectorLiteDashboardRoute, isDirectorLiteRouteOptedOut } from "./director-lite-routes";

const dashboardRoot = join(process.cwd(), "src", "app", "(dashboard)");

function pageRoutes(directory = dashboardRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) return pageRoutes(absolute);
    if (entry.name !== "page.tsx") return [];

    const route = relative(dashboardRoot, absolute)
      .split(sep)
      .slice(0, -1)
      .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"));
    return [`/${route.join("/")}`.replace(/\/$/, "") || "/"];
  });
}

describe("rotas do Diretor Lite", () => {
  // Desde 20/11 o Lite é a única versão: o teste não mantém mais a lista inteira de rotas revisadas (ficava velha a
  // cada tela nova). Ele garante que o opt-out só cita rotas que existem e que as áreas principais estão no Lite.
  it("o opt-out só cita rotas que existem e as áreas principais ficam no Lite", () => {
    const routes = new Set(pageRoutes());
    const stale = DIRECTOR_LITE_OPT_OUT_ROUTES.filter((route) => !routes.has(route));
    expect(stale).toEqual([]);
    expect(DIRECTOR_LITE_OPT_OUT_ROUTES.length).toBeGreaterThan(0);
    for (const route of ["/dashboard", "/leads", "/leads/distribuicao", "/leads/distribuicao/plantao", "/conversas", "/vendas", "/clientes", "/equipe", "/marketing/campanhas", "/qualificacao", "/settings", "/implantacoes"]) {
      expect(routes.has(route), route).toBe(true);
      expect(isDirectorLiteRouteOptedOut(route), route).toBe(false);
    }
  });

  it("tira o painel do opt-out, com ou sem query string", () => {
    expect(isDirectorLiteRouteOptedOut("/dashboard")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/dashboard?periodo=7")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/dashboard/drill/out-of-sla")).toBe(false);
  });

  it("tira /leads, o perfil do lead e os arquivados do opt-out, mas mantém as demais subrotas", () => {
    expect(isDirectorLiteRouteOptedOut("/leads")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads?view=kanban&page=2")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads/abc-123")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads/abc-123/feedback")).toBe(true);
    expect(isDirectorLiteRouteOptedOut("/leads/arquivados")).toBe(false);
  });

  it("tira /relacionamento e as telas de clientes do opt-out", () => {
    expect(isDirectorLiteRouteOptedOut("/relacionamento")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/clientes/client-1")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/clientes")).toBe(false);
  });

  it("libera a central de conversas e a visão geral no gate e mantém opt-out da rota de corretor", () => {
    expect(isDirectorLiteRouteOptedOut("/conversas")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/conversas?tab=leads")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/conversas/broker")).toBe(true);
    expect(isDirectorLiteRouteOptedOut("/conversas/dashboard")).toBe(false);
  });

  it("reconhece rotas dinâmicas e remove query string", () => {
    expect(isDirectorLiteDashboardRoute("/leads/abc-123/feedback?ficha=1")).toBe(true);
    expect(isDirectorLiteRouteOptedOut("/gestao/equipes/supervisor-1/")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/mensagens/lead-1/")).toBe(true);
    expect(isDirectorLiteRouteOptedOut("/rota-ainda-nao-revisada")).toBe(false);
  });

  it("rota fixa revisada vence a rota dinâmica irmã ainda em opt-out", () => {
    expect(isDirectorLiteRouteOptedOut("/equipe/recuperacoes")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/equipe/membro-123")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/equipe/plantao")).toBe(true);
  });

  it("tira a central de distribuição do opt-out e mantém os detalhes ainda não revisados", () => {
    expect(isDirectorLiteRouteOptedOut("/distribuicao?view=resumo_dia")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/distribuicao/dashboard")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads/distribuicao?view=roteamento")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads/distribuicao/plantao/schedule-123")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/plantoes/corretor/broker-123")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/plantoes/agora")).toBe(false);
  });

  it("o drill-down do painel e o de relatórios (mesma página) ficam sempre do mesmo lado do opt-out", () => {
    expect(isDirectorLiteRouteOptedOut("/dashboard/drill/out-of-sla")).toBe(isDirectorLiteRouteOptedOut("/relatorios/drill/out-of-sla"));
    expect(isDirectorLiteRouteOptedOut("/relatorios/drill/[drillId]")).toBe(false);
  });
});
