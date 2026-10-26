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
    expect([...revised].sort()).toEqual(["/assinatura", "/assistente", "/atendimento", "/atendimento/fluxo", "/atendimento/mensagens", "/atendimento/situacoes", "/clientes", "/clientes/[clientId]", "/configuracoes/comissoes", "/conversas", "/conversas/dashboard", "/dashboard", "/dashboard/drill/[drillId]", "/distribuicao", "/distribuicao/dashboard", "/documentos", "/empresas", "/equipe", "/equipe/[id]", "/equipe/cargos", "/equipe/convidar", "/equipe/dashboard", "/equipe/recuperacoes", "/ferramentas", "/ferramentas/materiais-operadoras", "/ferramentas/validador-comprovante", "/filiais", "/fluxos-whatsapp", "/gestao", "/gestao/equipes/[supervisorId]", "/guia", "/guia/webhook", "/integrations", "/integrations/meta", "/integrations/whats_alt", "/integrations/whatsapp", "/integridade", "/leads", "/leads/[id]", "/leads/arquivados", "/leads/dashboard", "/leads/distribuicao", "/leads/distribuicao/plantao/[scheduleId]", "/marketing", "/marketing/campanhas", "/marketing/campanhas/[id]", "/marketing/importacoes", "/marketing/meta", "/minha-fila", "/noc", "/notificacoes", "/plantoes/agora", "/plantoes/corretor/[brokerId]", "/propostas", "/qualificacao", "/qualificacao/turbo", "/relacionamento", "/relatorios", "/relatorios/drill/[drillId]", "/roadmap", "/settings", "/settings/extension", "/settings/feedback-templates", "/settings/integrations", "/settings/meta", "/settings/waha-diagnostic", "/settings/whatsapp", "/tarefas/dashboard", "/unidades/[branchId]", "/vendas", "/vendas/[id]", "/vendas/dashboard", "/welcome"]);
    expect(DIRECTOR_LITE_OPT_OUT_ROUTES.length).toBeGreaterThan(0);
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
