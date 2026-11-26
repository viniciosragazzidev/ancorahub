import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { routeCatalog } from "@/features/custom-roles/routes";

import { NAV_AREAS, NAV_GROUPS, canShowNavTab, groupNavItems, isNavTabRoot, navRowTabs, resolveNavLocation, visibleNavAreas, type NavAccessUser } from "./nav-registry";

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
  "/call-ancora": "Demonstração: item próprio no rodapé da barra lateral, fora das áreas",
  "/meu-financeiro": "Light do corretor (as próprias comissões)",
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
  "/roadmap": "redirect antigo, sem tela",
  "/internal/design-system": "vitrine interna do design",
  "/internal/design-system/motion": "vitrine interna do design",
  "/conversas/dashboard": "redirect para a área (visão antiga removida em 26/11)",
  "/leads/dashboard": "redirect para a área (visão antiga removida em 26/11)",
  "/distribuicao/dashboard": "redirect para a área (visão antiga removida em 26/11)",
  "/vendas/dashboard": "redirect para a área (visão antiga removida em 26/11)",
  "/equipe/dashboard": "redirect para a área (visão antiga removida em 26/11)",
  "/settings/waha-diagnostic": "entra em Configurações > WhatsApp numa fase própria",
  "/tarefas/dashboard": "redirect para a área (visão antiga removida em 26/11)",
  "/conversas/broker": "Light do corretor (dicas de atendimento)",
  "/equipe/controle": "Light do supervisor",
  "/equipe/observacoes": "Light do supervisor",
  "/integrations/whats_alt": "redirect para Configurações > WhatsApp",
  "/marketing/meta": "redirect para Marketing > Campanhas",
  "/settings/integrations": "redirect para Configurações > Integrações",
  "/settings/meta": "redirect para Configurações > Integrações",
  "/settings/whatsapp": "redirect para Configurações > WhatsApp",
};

const director: NavAccessUser = {
  roleKey: "director",
  jobTitle: null,
  permissions: ["acessar_dashboard", "acessar_conversas", "acessar_leads", "acessar_qualificacao_ia", "acessar_vendas", "acessar_clientes", "acessar_documentos", "ver_comissionamento", "acessar_ferramentas", "convidar_corretor", "acessar_campanhas_meta", "importar_leads_meta", "acessar_configuracoes_pessoais", "acessar_integracao_meta", "ver_dashboard_equipe"],
  relationshipCenterEnabled: true,
  negotiationsEnabled: true,
};

describe("nav-registry", () => {
  it("shows ERP only for server-resolved paths without widening the old manager menu", () => {
    const tab = NAV_AREAS.find((area) => area.id === "erp")!.tabs[0];
    const manager: NavAccessUser = { roleKey: "manager", jobTitle: "manager", permissions: ["erp_view_operations", "acessar_vendas"] };
    expect(canShowNavTab(tab, manager)).toBe(false);
    expect(canShowNavTab(tab, { ...manager, erpPaths: ["/implantacoes"] })).toBe(true);
    expect(visibleNavAreas({ ...manager, erpPaths: ["/implantacoes"] }).some((row) => row.area.id === "comercial")).toBe(false);
  });
  // Toda tela tem porta (26/11/2026, docs/research/deskcomm-interface-conversao.md, lote 3). Tela fixa precisa estar
  // escrita no cadastro (href, paths ou alsoAt), não basta casar pelo começo do endereço: era assim que /equipe/observacoes
  // e outras ficavam "dentro" de uma área por acaso. Só o detalhe de uma entidade ([id]) herda a área pelo prefixo.
  it("every dashboard page belongs to an area or is listed outside on purpose", () => {
    const declared = new Set(NAV_AREAS.flatMap((area) => area.tabs.flatMap((tab) => [tab.href.split(/[?#]/, 1)[0], ...(tab.paths ?? []), ...(tab.alsoAt ?? [])])));
    const loose = dashboardPages()
      .filter((page) => !OUTSIDE_AREAS[page])
      .filter((page) => (page.includes("[") ? !resolveNavLocation(page.replace(/\[[^\]]+\]/g, "x")) : !declared.has(page)));
    expect(loose).toEqual([]);
  });

  it("the outside list has no stale entries and every reason says why", () => {
    const pages = new Set(dashboardPages());
    for (const [page, reason] of Object.entries(OUTSIDE_AREAS)) {
      expect(pages.has(page), `${page} não existe mais: tire da lista`).toBe(true);
      expect(reason.length, `${page}: escreva o motivo`).toBeGreaterThanOrEqual(10);
    }
  });

  it("every tab opens a page that exists and says what it is for", () => {
    const pages = new Set(dashboardPages());
    for (const area of NAV_AREAS) {
      for (const tab of area.tabs) {
        expect(pages.has(tab.href.split(/[?#]/, 1)[0]), `${area.id}:${tab.id} aponta para ${tab.href}, que não existe`).toBe(true);
        expect(tab.description.trim().length, `${area.id}:${tab.id} sem descrição`).toBeGreaterThan(10);
        expect(tab.description).not.toMatch(/—/);
      }
    }
  });

  // Teste de altura (DeskComm): com todos os grupos abertos, o menu do diretor com tudo ligado cabe em 1280x900 sem
  // rolar. Conta linhas de 44px (alvo de toque) mais o topo (logo e atalhos) e o rodapé (Call Âncora, Agente IA, perfil).
  it("the full director menu fits 900px of height without scrolling", () => {
    const everything: NavAccessUser = { ...director, permissions: [...(director.permissions ?? []), "ver_comissao_propria", "acessar_financeiro", "erp_view_finance", "erp_view_operations", "erp_manage_referrals", "erp_view_analytics", "erp_import_data", "erp_manage_modules"], postSaleAuditEnabled: true, autoSaleEnabled: true, erpPaths: NAV_AREAS.flatMap((area) => area.tabs.map((tab) => tab.href.split(/[?#]/, 1)[0])) };
    const groups = groupNavItems(visibleNavAreas(everything).map(({ area }) => area));
    const rows = groups.reduce((total, { items }) => total + (items.length > 1 ? items.length + 1 : 1), 0);
    const ROW = 44;
    const TOP = 64 + ROW; // logo + Área de Plantão
    const BOTTOM = ROW * 3; // Call Âncora, Agente IA, perfil
    expect(TOP + rows * ROW + BOTTOM).toBeLessThanOrEqual(900);
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

  it("Atendimento IA: the menu opens the hub /ia and its screens belong to the area", () => {
    expect(visibleNavAreas(director).find((item) => item.area.id === "atendimento-ia")?.href).toBe("/ia");
    expect(resolveNavLocation("/ia")).toMatchObject({ area: { id: "atendimento-ia" }, tab: { id: "inicio" } });
    expect(resolveNavLocation("/ia/alertas")).toMatchObject({ area: { id: "atendimento-ia" }, tab: { id: "alertas" } });
    expect(resolveNavLocation("/ia/execucoes?falhas=1")).toMatchObject({ area: { id: "atendimento-ia" }, tab: { id: "execucoes" } });
    expect(resolveNavLocation("/qualificacao/leads")).toMatchObject({ tab: { id: "leads-qualificacao" } });
    expect(isNavTabRoot("/ia/alertas")).toBe(true);
  });

  it("Atendimento IA: only the daily tabs stay on top, a hub tab joins the row while open", () => {
    const area = NAV_AREAS.find((item) => item.id === "atendimento-ia")!;
    const fullDirector: NavAccessUser = { ...director, permissions: [...(director.permissions ?? []), "acessar_ferramentas"] };
    expect(navRowTabs(area, fullDirector, "inicio").map((tab) => tab.id)).toEqual(["inicio", "leads-qualificacao", "alertas", "execucoes"]);
    expect(navRowTabs(area, fullDirector, "simulador").map((tab) => tab.id)).toEqual(["inicio", "leads-qualificacao", "alertas", "execucoes", "simulador"]);
    expect(area.tabs.filter((tab) => !tab.hub).map((tab) => tab.id)).toEqual(["inicio", "leads-qualificacao", "alertas", "execucoes"]);
    // Other areas have no hub tabs: their row is unchanged.
    const comercial = NAV_AREAS.find((item) => item.id === "comercial")!;
    expect(navRowTabs(comercial, director, "vendas")).toEqual(comercial.tabs.filter((tab) => canShowNavTab(tab, director)));
  });

  it("Distribuição: views by ?view=, the old /leads/distribuicao address and the duty detail", () => {
    expect(resolveNavLocation("/distribuicao")).toMatchObject({ area: { id: "distribuicao" }, tab: { id: "hoje" } });
    expect(resolveNavLocation("/distribuicao?view=resumo_dia")).toMatchObject({ tab: { id: "hoje" } });
    expect(resolveNavLocation("/leads/distribuicao?view=roteamento")).toMatchObject({ tab: { id: "regras" } });
    expect(resolveNavLocation("/distribuicao?view=historico")).toMatchObject({ tab: { id: "saude" } });
    expect(resolveNavLocation("/leads/distribuicao/plantao/abc")).toMatchObject({ tab: { id: "plantoes" } });
    const manager: NavAccessUser = { ...director, roleKey: "manager" };
    const distribution = NAV_AREAS.find((area) => area.id === "distribuicao")!;
    expect(distribution.tabs.filter((tab) => canShowNavTab(tab, manager)).map((tab) => tab.id)).not.toContain("filas");
  });

  it("Distribuição: with a cargo only the tabs it grants show, the same rule as the page", async () => {
    const { DISTRIBUTION_VIEW_CAPABILITY } = await import("@/features/lead-distribution/distribution-view-access");
    const distribution = NAV_AREAS.find((area) => area.id === "distribuicao")!;
    const viewOf: Record<string, string> = { hoje: "resumo_dia", regras: "roteamento", filas: "filas", plantoes: "plantao", saude: "saude_historico" };
    for (const tab of distribution.tabs) expect(tab.cargoCapability).toBe(DISTRIBUTION_VIEW_CAPABILITY[viewOf[tab.id] as keyof typeof DISTRIBUTION_VIEW_CAPABILITY]);
    const cargo: NavAccessUser = { ...director, permissions: [...(director.permissions ?? []), "route:distribuicao", "duty_schedules_manage"] };
    expect(distribution.tabs.filter((tab) => canShowNavTab(tab, cargo)).map((tab) => tab.id)).toEqual(["plantoes"]);
  });

  it("Cargos and Recuperações de acesso stay hidden for whoever has a cargo (the pages refuse them)", () => {
    const settings = NAV_AREAS.find((area) => area.id === "configuracoes")!;
    const withCargo: NavAccessUser = { ...director, permissions: [...(director.permissions ?? []), "route:equipe"] };
    const shown = settings.tabs.filter((tab) => canShowNavTab(tab, withCargo)).map((tab) => tab.id);
    expect(shown).not.toContain("cargos");
    expect(shown).not.toContain("recuperacoes");
    expect(settings.tabs.filter((tab) => canShowNavTab(tab, director)).map((tab) => tab.id)).toEqual(expect.arrayContaining(["cargos", "recuperacoes"]));
  });

  it("only views the page switches by itself change the URL in place", () => {
    const inPlace = NAV_AREAS.flatMap((area) => area.tabs).filter((tab) => tab.inPlace).map((tab) => tab.href);
    expect(inPlace.every((href) => href.startsWith("/qualificacao"))).toBe(true);
  });

  it("the director sees 9 menu items, each opening its first visible tab", () => {
    const areas = visibleNavAreas(director);
    expect(areas.map((item) => item.area.id)).toEqual(["inicio", "conversas", "leads", "distribuicao", "comercial", "equipe", "atendimento-ia", "marketing", "configuracoes"]);
    expect(areas.find((item) => item.area.id === "comercial")?.href).toBe("/vendas");
  });

  it("Comercial opens at Vendas, like the old menu item, and hides Negociações while it is off", () => {
    const areas = visibleNavAreas({ ...director, negotiationsEnabled: false });
    const comercial = areas.find((item) => item.area.id === "comercial")!;
    expect(comercial.href).toBe("/vendas");
    expect(comercial.tabs.map((tab) => tab.id)).not.toContain("negociacoes");
  });

  it("role-only tabs stay hidden for other roles", () => {
    const manager: NavAccessUser = { ...director, roleKey: "manager" };
    const cargos = NAV_AREAS.find((area) => area.id === "configuracoes")!.tabs.find((tab) => tab.id === "cargos")!;
    expect(canShowNavTab(cargos, director)).toBe(true);
    expect(canShowNavTab(cargos, manager)).toBe(false);
  });

  it("shows the post-sale workspace only to directors when enabled (gestor sem pós-venda desde 10/11)", () => {
    const team = NAV_AREAS.find((area) => area.id === "equipe")!;
    const postSale = team.tabs.find((tab) => tab.id === "pos-venda")!;
    expect(canShowNavTab(postSale, director)).toBe(false);
    expect(canShowNavTab(postSale, { ...director, postSaleAuditEnabled: true })).toBe(true);
    expect(canShowNavTab(postSale, { ...director, roleKey: "manager", postSaleAuditEnabled: true })).toBe(false);
    expect(canShowNavTab(postSale, { ...director, roleKey: "broker", postSaleAuditEnabled: true })).toBe(false);
  });

  it("a broker does not see management areas", () => {
    const broker: NavAccessUser = { roleKey: "broker", jobTitle: null, permissions: ["acessar_dashboard", "acessar_conversas", "acessar_leads", "acessar_vendas", "acessar_clientes", "acessar_documentos", "acessar_configuracoes_pessoais"] };
    const ids = visibleNavAreas(broker).map((item) => item.area.id);
    expect(ids).not.toContain("distribuicao");
    expect(ids).not.toContain("atendimento-ia");
    expect(ids).not.toContain("equipe");
  });

  it("tab roots have no parent in the director chrome", () => {
    // Propostas e Comissões abrem por ?tab= (o next.config redireciona as rotas antigas para lá).
    expect(isNavTabRoot("/vendas?tab=propostas")).toBe(true);
    expect(isNavTabRoot("/settings?tab=comissoes")).toBe(true);
    expect(isNavTabRoot("/equipe/cargos")).toBe(true);
    expect(isNavTabRoot("/leads/abc")).toBe(false);
  });

  it("every main route of the permission catalog is reachable from an area", () => {
    const mainRoutes = routeCatalog.filter((route) => !("legacyOpen" in route && route.legacyOpen)).map((route) => route.path);
    const missing = mainRoutes.filter((route) => !resolveNavLocation(route));
    expect(missing).toEqual([]);
  });
  it("groups the director menu from operation to settings, each area in one group only", () => {
    const grouped = groupNavItems(visibleNavAreas(director).map(({ area }) => ({ id: area.id })));
    expect(grouped.map(({ group, items }) => [group.label, items.map((item) => item.id)])).toEqual([
      ["Início", ["inicio"]],
      ["Conversas", ["conversas"]],
      ["Leads", ["leads", "distribuicao"]],
      ["Comercial", ["comercial"]],
      ["Crescimento", ["atendimento-ia", "marketing"]],
      ["Equipe", ["equipe"]],
      ["Configurações", ["configuracoes"]],
    ]);
    const all = NAV_GROUPS.flatMap((group) => group.areas);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(NAV_AREAS.map((area) => area.id).sort());
  });
});
