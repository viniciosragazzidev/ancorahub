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
  it("mantém em opt-out todas as páginas ainda não revisadas (saíram o painel, a lista e o perfil do lead e as telas simples da passada rápida)", () => {
    const revised = pageRoutes().filter((route) => !isDirectorLiteRouteOptedOut(route));
    expect([...revised].sort()).toEqual(["/dashboard", "/documentos", "/empresas", "/ferramentas", "/leads", "/leads/[id]", "/notificacoes", "/propostas", "/tarefas/dashboard", "/vendas", "/vendas/[id]"]);
    expect(DIRECTOR_LITE_OPT_OUT_ROUTES.length).toBeGreaterThan(0);
  });

  it("tira o painel do opt-out, com ou sem query string", () => {
    expect(isDirectorLiteRouteOptedOut("/dashboard")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/dashboard?periodo=7")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/dashboard/drill/out-of-sla")).toBe(true);
  });

  it("tira /leads e o perfil do lead do opt-out, mas mantém as demais subrotas", () => {
    expect(isDirectorLiteRouteOptedOut("/leads")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads?view=kanban&page=2")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads/abc-123")).toBe(false);
    expect(isDirectorLiteRouteOptedOut("/leads/abc-123/feedback")).toBe(true);
    expect(isDirectorLiteRouteOptedOut("/leads/arquivados")).toBe(true);
  });

  it("reconhece rotas dinâmicas e remove query string", () => {
    expect(isDirectorLiteDashboardRoute("/leads/abc-123/feedback?ficha=1")).toBe(true);
    expect(isDirectorLiteRouteOptedOut("/gestao/equipes/supervisor-1/")).toBe(true);
    expect(isDirectorLiteRouteOptedOut("/rota-ainda-nao-revisada")).toBe(false);
  });

  it("inclui a distribuição abreviada no inventário opt-out", () => {
    expect(DIRECTOR_LITE_OPT_OUT_ROUTES).toContain("/distribuicao");
  });
});
