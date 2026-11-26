import { describe, expect, it } from "vitest";

import { canShowNavTab, NAV_AREAS, visibleNavAreas, type NavAccessUser } from "@/shared/navigation/nav-registry";
import { hasPermission, PERMISSIONS, type PermissionKey } from "@/shared/auth/permissions";

import { isManagerAiAreaPathAllowed, isManagerRouteAllowed, isOutsideManagerScope, MANAGER_SETTINGS_TABS } from "./manager-routes";

const ALLOWED = [
  "/dashboard",
  "/equipe",
  "/equipe/plantoes",
  "/equipe/pos-venda",
  "/equipe/convidar",
  "/equipe/7f1c2b9e-0000-4000-8000-000000000001",
  "/unidades/branch-1",
  "/plantoes/corretor/broker-1",
  "/plantoes/corretor/broker-1?plantao=schedule-1",
  "/leads/7f1c2b9e-0000-4000-8000-000000000002",
  "/tarefas",
  "/tarefas?escopo=minhas",
  "/ia/perguntas",
  "/ia/perguntas?aba=abertas",
  "/notificacoes",
  "/settings",
  "/settings?tab=seguranca",
  "/primeiro-acesso",
  "/access-denied",
];

// Configuração do sistema, distribuição, conversas de qualificação, comercial, leads em geral, marketing,
// atendimento IA, pós-venda (decisão de 10/11) e as telas do Lite.
const BLOCKED = [
  "/", "/leads", "/leads/arquivados", "/leads/dashboard", "/leads/distribuicao", "/leads/distribuicao/plantao/abc",
  "/distribuicao", "/distribuicao/dashboard", "/conversas", "/conversas/dashboard", "/mensagens", "/mensagens/abc",
  "/negociacoes", "/vendas", "/propostas", "/clientes", "/clientes/abc", "/documentos", "/configuracoes/comissoes",
  "/ferramentas", "/ferramentas/validador-comprovante", "/marketing", "/marketing/campanhas", "/marketing/importacoes",
  "/qualificacao", "/qualificacao/turbo", "/atendimento/situacoes", "/atendimento/mensagens", "/atendimento/fluxo",
  "/fluxos-whatsapp", "/assistente", "/integrations", "/integrations/meta", "/integrations/whatsapp",
  "/settings/feedback-templates", "/settings/waha-diagnostic", "/settings/extension", "/settings/whatsapp",
  "/equipe/cargos", "/equipe/recuperacoes", "/equipe/dashboard", "/equipe/minha",
  "/equipe/plantao", "/equipe/desempenho", "/equipe/transferencia", "/equipe/repassar", "/gestao", "/gestao/equipes/abc",
  "/relacionamento", "/noc", "/assinatura", "/guia", "/guia/webhook", "/relatorios", "/relatorios/drill/abc",
  "/empresas", "/integridade", "/tarefas/dashboard", "/cotacao", "/plantoes", "/plantoes/agora", "/filiais", "/roadmap",
  "/dashboard/drill/abc", "/dashboard/c/jornada", "/extensao", "/internal/design-system",
  // Atendimento IA segue fechado; só /ia/perguntas abriu (26/11).
  "/ia", "/ia/alertas", "/ia/execucoes", "/ia/execucoes?falhas=1", "/ia/perguntas/abc", "/ia/perguntasx",
];

describe("rotas do gestor na versão antiga (10/11)", () => {
  it.each(ALLOWED)("libera %s", (path) => {
    expect(isManagerRouteAllowed(path)).toBe(true);
  });

  it.each(BLOCKED)("bloqueia %s", (path) => {
    expect(isManagerRouteAllowed(path)).toBe(false);
  });

  it("na área da IA o gestor só abre Perguntas para a direção (26/11)", () => {
    expect(isManagerAiAreaPathAllowed("/ia/perguntas")).toBe(true);
    expect(isManagerAiAreaPathAllowed("/ia/perguntas/")).toBe(true);
    expect(isManagerAiAreaPathAllowed("/ia/perguntas?x=1")).toBe(true);
    for (const path of ["/ia", "/ia/alertas", "/ia/execucoes", "/ia/perguntas/abc"]) expect(isManagerAiAreaPathAllowed(path)).toBe(false);
  });

  it("Ajustes do gestor ficam só com conta e segurança", () => {
    expect([...MANAGER_SETTINGS_TABS]).toEqual(["conta", "seguranca"]);
  });

  it("só o gestor de unidade perde as áreas de sistema; marketing e financeiro (papel manager) seguem", () => {
    expect(isOutsideManagerScope("manager")).toBe(true);
    expect(isOutsideManagerScope("manager", "manager")).toBe(true);
    expect(isOutsideManagerScope("manager", "broker")).toBe(true);
    expect(isOutsideManagerScope("manager", "marketing")).toBe(false);
    expect(isOutsideManagerScope("manager", "finance")).toBe(false);
    for (const role of ["director", "supervisor", "broker"]) expect(isOutsideManagerScope(role, role)).toBe(false);
  });
});

function userFor(role: "director" | "manager" | "supervisor" | "broker"): NavAccessUser {
  const permissions = (Object.keys(PERMISSIONS) as PermissionKey[]).filter((key) => hasPermission(role, key));
  return { roleKey: role, jobTitle: role, permissions, negotiationsEnabled: true, postSaleAuditEnabled: true, relationshipCenterEnabled: true };
}

describe("menu do gestor (10/11)", () => {
  it("mostra só Início (Painel), Tarefas (25/11) e Ligações (26/11), Equipe (Pessoas, Plantões da unidade e Pós-venda com a chave), Perguntas para a direção (26/11) e Configurações (Ajustes)", () => {
    const areas = visibleNavAreas(userFor("manager"));
    expect(areas.map(({ area, tabs }) => [area.id, tabs.map((tab) => tab.id)])).toEqual([
      ["inicio", ["painel"]],
      ["leads", ["tarefas", "ligacoes"]],
      ["equipe", ["pessoas", "plantoes-unidade", "pos-venda"]],
      ["atendimento-ia", ["perguntas-direcao"]],
      ["configuracoes", ["ajustes"]],
    ]);
  });

  it("toda aba visível ao gestor é uma rota que o servidor libera", () => {
    const manager = userFor("manager");
    for (const area of NAV_AREAS) {
      for (const tab of area.tabs) {
        if (canShowNavTab(tab, manager)) expect(isManagerRouteAllowed(tab.href)).toBe(true);
      }
    }
  });

  it("a área da IA do gestor abre direto em /ia/perguntas; marketing e financeiro não veem a aba", () => {
    const ia = visibleNavAreas(userFor("manager")).find(({ area }) => area.id === "atendimento-ia");
    expect(ia?.href).toBe("/ia/perguntas");
    for (const jobTitle of ["marketing", "finance"]) {
      const user = { ...userFor("manager"), jobTitle };
      const tabs = visibleNavAreas(user).find(({ area }) => area.id === "atendimento-ia")?.tabs ?? [];
      expect(tabs.map((tab) => tab.id)).not.toContain("perguntas-direcao");
    }
  });

  it("o diretor continua com as áreas de sistema e não vê a aba de plantões do gestor", () => {
    const ids = visibleNavAreas(userFor("director")).map(({ area }) => area.id);
    expect(ids).toEqual(expect.arrayContaining(["distribuicao", "comercial", "atendimento-ia", "marketing", "configuracoes"]));
    const equipe = visibleNavAreas(userFor("director")).find(({ area }) => area.id === "equipe");
    expect(equipe?.tabs.map((tab) => tab.id)).not.toContain("plantoes-unidade");
  });

  it("o gestor perdeu as capacidades de distribuição, atendimento IA, marketing e integrações", () => {
    for (const key of ["acessar_qualificacao_ia", "lead_queues_view", "lead_queues_manage", "distribution_settings_manage", "duty_schedules_manage", "distribution_audit_view", "leads_bulk_assign", "leads_route_to_unit", "importar_leads_meta", "ver_importacoes_meta", "acessar_campanhas_meta", "acessar_integracao_meta", "importar_planilhas", "gerenciar_materiais_divulgacao"] as PermissionKey[]) {
      expect(hasPermission("manager", key)).toBe(false);
      expect(hasPermission("director", key)).toBe(true);
    }
  });
});
