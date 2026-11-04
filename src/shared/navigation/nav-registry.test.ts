import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { routeCatalog } from "@/features/custom-roles/routes";

import { NAV_AREAS, canShowNavTab, isNavTabRoot, resolveNavLocation, visibleNavAreas, type NavAccessUser } from "./nav-registry";

const DASHBOARD_DIR = path.join(process.cwd(), "src", "app", "(dashboard)");

/** Every page under (dashboard) as a URL pattern ([id] segments kept as "[x]"). */
function dashboardPages(dir = DASHBOARD_DIR, prefix = ""): string[] {
  const pages: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) {
      if (entry === "page.tsx") pages.push(prefix || "/");
      continue;
    }
    if (entry.startsWith("_") || entry === "node_modules") continue;
    const segment = entry.startsWith("(") ? "" : `/${entry}`;
    pages.push(...dashboardPages(full, `${prefix}${segment}`));
  }
  return pages;
}

/**
 * Pages outside the areas on purpose: the Light apps (broker, supervisor, manager), personal screens reached
 * from the user menu, onboarding, redirect-only pages and screens still waiting for their area (see the plan).
 * A new page must join an area in nav-registry or be listed here with a reason.
 */
const OUTSIDE_AREAS: Record<string, string> = {
  "/minha-fila": "redirect para /leads (next.config)",
  "/agenda": "Light do corretor",
  "/desempenho": "Light do corretor",
  "/jornada": "Light do corretor",
  "/cotacao": "Light do corretor",
  "/plantoes": "Light do corretor",
  "/plantoes/agora": "Light do corretor",
  "/plantoes/corretor/[brokerId]": "Light do supervisor e do gerente",
  "/empresas": "Light do gerente",
  "/gestao": "Light do gerente; entra em Equipe numa fase própria",
  "/gestao/equipes/[supervisorId]": "Light do gerente",
  "/equipe/minha": "Light do supervisor",
  "/equipe/minha/configurar": "Light do supervisor",
  "/equipe/desempenho": "Light do supervisor",
  "/equipe/plantao": "Light do supervisor",
  "/equipe/transferencia": "Light do supervisor",
  "/equipe/repassar": "Light do supervisor",
  "/notificacoes": "menu do usuário",
  "/guia": "menu do usuário (Ajuda)",
  "/welcome": "onboarding",
  "/assistente": "sai na limpeza final",
  "/assinatura": "entra em Configurações numa fase própria",
  "/integridade": "vai para o super-dev",
  "/roadmap": "redirect",
  "/internal/design-system": "interna",
  "/internal/design-system/motion": "interna",
  "/conversas/dashboard": "tela morta, sai na limpeza final",
  "/leads/dashboard": "tela morta, sai na limpeza final",
  "/distribuicao/dashboard": "tela morta, sai na limpeza final",
  "/vendas/dashboard": "tela morta, sai na limpeza final",
  "/equipe/dashboard": "tela morta, sai na limpeza final",
  "/tarefas/dashboard": "tela morta, sai na limpeza final",
  "/settings/waha-diagnostic": "entra em Configurações > WhatsApp numa fase própria",
};

const director: NavAccessUser = {
  roleKey: "director",
  jobTitle: null,
  permissions: ["acessar_dashboard", "acessar_conversas", "acessar_leads", "acessar_qualificacao_ia", "acessar_vendas", "acessar_clientes", "acessar_documentos", "ver_comissionamento", "acessar_ferramentas", "convidar_corretor", "acessar_campanhas_meta", "importar_leads_meta", "acessar_configuracoes_pessoais", "acessar_integracao_meta", "ver_dashboard_equipe"],
  relationshipCenterEnabled: true,
  negotiationsEnabled: true,
};

describe("nav-registry", () => {
  it("every dashboard page belongs to an area or is listed outside on purpose", () => {
    const loose = dashboardPages()
      .filter((page) => !OUTSIDE_AREAS[page])
      .filter((page) => !resolveNavLocation(page.replace(/\[[^\]]+\]/g, "x")));
    expect(loose).toEqual([]);
  });

  it("tab ids are unique inside each area", () => {
    for (const area of NAV_AREAS) {
      const ids = area.tabs.map((tab) => tab.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("the most specific tab wins", () => {
    expect(resolveNavLocation("/equipe/cargos")).toMatchObject({ area: { id: "configuracoes" }, tab: { id: "cargos" } });
    expect(resolveNavLocation("/equipe/123")).toMatchObject({ area: { id: "equipe" }, tab: { id: "pessoas" } });
    expect(resolveNavLocation("/leads/distribuicao/plantao/abc")).toMatchObject({ area: { id: "distribuicao" } });
    expect(resolveNavLocation("/leads/abc")).toMatchObject({ area: { id: "leads" }, tab: { id: "leads" } });
    expect(resolveNavLocation("/integrations/whatsapp")).toMatchObject({ area: { id: "configuracoes" }, tab: { id: "whatsapp" } });
    expect(resolveNavLocation("/integrations/meta")).toMatchObject({ tab: { id: "integracoes" } });
    expect(resolveNavLocation("/ferramentas/materiais-operadoras")).toMatchObject({ area: { id: "atendimento-ia" } });
    expect(resolveNavLocation("/propostas")).toMatchObject({ area: { id: "comercial" }, tab: { id: "propostas" } });
    expect(resolveNavLocation("/dashboard?tab=quality")).toMatchObject({ area: { id: "inicio" } });
  });

  it("views of the same page match by query, and old values keep working", () => {
    expect(resolveNavLocation("/qualificacao")).toMatchObject({ area: { id: "atendimento-ia" }, tab: { id: "comportamento" } });
    expect(resolveNavLocation("/qualificacao?tab=followup_rules")).toMatchObject({ tab: { id: "follow-up" } });
    expect(resolveNavLocation("/qualificacao", new URLSearchParams("tab=simulator"))).toMatchObject({ tab: { id: "simulador" } });
    expect(resolveNavLocation("/qualificacao?tab=alerts")).toMatchObject({ tab: { id: "simulador" } });
    expect(resolveNavLocation("/qualificacao?tab=mcp_governance")).toMatchObject({ tab: { id: "permissoes" } });
    expect(resolveNavLocation("/qualificacao?tab=training")).toMatchObject({ tab: { id: "comportamento" } });
    expect(resolveNavLocation("/qualificacao/turbo")).toMatchObject({ tab: { id: "turbo" } });
    expect(resolveNavLocation("/atendimento")).toMatchObject({ area: { id: "atendimento-ia" }, tab: { id: "situacoes" } });
    expect(resolveNavLocation("/atendimento/fluxo")).toMatchObject({ tab: { id: "perguntas" } });
  });

  it("the director sees 9 menu items, each opening its first visible tab", () => {
    const areas = visibleNavAreas(director);
    expect(areas.map((item) => item.area.id)).toEqual(["inicio", "conversas", "leads", "distribuicao", "comercial", "equipe", "atendimento-ia", "marketing", "configuracoes"]);
    expect(areas.find((item) => item.area.id === "comercial")?.href).toBe("/negociacoes");
  });

  it("Comercial starts at Propostas while negotiations are off", () => {
    const areas = visibleNavAreas({ ...director, negotiationsEnabled: false });
    expect(areas.find((item) => item.area.id === "comercial")?.href).toBe("/propostas");
  });

  it("role-only tabs stay hidden for other roles", () => {
    const manager: NavAccessUser = { ...director, roleKey: "manager" };
    const cargos = NAV_AREAS.find((area) => area.id === "configuracoes")!.tabs.find((tab) => tab.id === "cargos")!;
    expect(canShowNavTab(cargos, director)).toBe(true);
    expect(canShowNavTab(cargos, manager)).toBe(false);
  });

  it("a broker does not see management areas", () => {
    const broker: NavAccessUser = { roleKey: "broker", jobTitle: null, permissions: ["acessar_dashboard", "acessar_conversas", "acessar_leads", "acessar_vendas", "acessar_clientes", "acessar_documentos", "acessar_configuracoes_pessoais"] };
    const ids = visibleNavAreas(broker).map((item) => item.area.id);
    expect(ids).not.toContain("distribuicao");
    expect(ids).not.toContain("atendimento-ia");
    expect(ids).not.toContain("equipe");
  });

  it("tab roots have no parent in the director chrome", () => {
    expect(isNavTabRoot("/propostas")).toBe(true);
    expect(isNavTabRoot("/equipe/cargos")).toBe(true);
    expect(isNavTabRoot("/leads/abc")).toBe(false);
  });

  it("every main route of the permission catalog is reachable from an area", () => {
    const mainRoutes = routeCatalog.filter((route) => !("legacyOpen" in route && route.legacyOpen)).map((route) => route.path);
    const missing = mainRoutes.filter((route) => !resolveNavLocation(route));
    expect(missing).toEqual([]);
  });
});
