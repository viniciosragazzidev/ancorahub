/**
 * Cadastro único da navegação do modo normal (e do diretor): áreas do menu lateral e as abas de cada área.
 * Cada funcionalidade mora em uma área só (docs/implementations/active/2026-11-04-organizacao-de-rotas.md).
 * Dados puros: o menu lateral, as abas da área e os títulos do diretor leem daqui.
 */
import type { PermissionKey } from "@/shared/auth/permissions";
import type { TenantRole } from "@/shared/db/schema";
import { canShowNavigationItem, type NavigationAccessUser } from "@/shared/navigation-access";

export type NavAreaId = "inicio" | "conversas" | "leads" | "distribuicao" | "comercial" | "erp" | "equipe" | "atendimento-ia" | "marketing" | "configuracoes";

export type NavSection = "Principal" | "Operação" | "Crescimento" | "Sistema";

export type NavTab = {
  id: string;
  label: string;
  href: string;
  permission: PermissionKey;
  /** Outros caminhos que pertencem a esta aba (o próprio href já conta). Prefixo: "/x" vale para "/x" e "/x/...". */
  paths?: readonly string[];
  /** Só estes papéis enxergam a aba (a página também barra os outros). */
  roles?: readonly TenantRole[];
  /** Escondida enquanto a chave correspondente estiver desligada. */
  requires?: "negotiations" | "relationshipCenter" | "postSaleAudit" | "autoSale" | "erp";
  /** Outros valores de query que abrem a mesma aba (links antigos), ex.: { tab: ["alerts"] }. */
  aliases?: Readonly<Record<string, readonly string[]>>;
  /**
   * A página troca esta visão sozinha pela query (componente de cliente lendo a URL): a aba muda só a URL,
   * sem ida ao servidor. Sem isso, a aba navega normalmente e a página renderiza de novo no servidor.
   */
  inPlace?: boolean;
  /** A mesma página também responde nestes endereços (ex.: /leads/distribuicao é /distribuicao). */
  alsoAt?: readonly string[];
  /**
   * Quem tem cargo só vê a aba com esta capacidade (mesma regra da página, DISTRIBUTION_VIEW_CAPABILITY).
   * Sem cargo vale só o papel, como antes.
   */
  cargoCapability?: string;
  /** Só para quem não tem cargo (a página recusa quem tem, ex.: /equipe/cargos). */
  noCargo?: boolean;
};

export type NavArea = {
  id: NavAreaId;
  label: string;
  fullLabel: string;
  section: NavSection;
  tabs: readonly NavTab[];
};

export const NAV_AREAS: readonly NavArea[] = [
  {
    id: "inicio",
    label: "Início",
    fullLabel: "Painel e indicadores",
    section: "Principal",
    tabs: [
      { id: "painel", label: "Painel", href: "/dashboard", permission: "acessar_dashboard", paths: ["/dashboard", "/relatorios"] },
      { id: "ao-vivo", label: "Ao vivo", href: "/noc", permission: "acessar_dashboard", roles: ["director", "manager", "supervisor"] },
    ],
  },
  {
    id: "conversas",
    label: "Conversas",
    fullLabel: "Atendimento e WhatsApp",
    section: "Principal",
    tabs: [
      { id: "conversas", label: "Conversas", href: "/conversas", permission: "acessar_conversas", paths: ["/conversas", "/mensagens"] },
    ],
  },
  {
    id: "leads",
    label: "Leads",
    fullLabel: "Leads e oportunidades",
    section: "Principal",
    tabs: [
      { id: "leads", label: "Leads", href: "/leads", permission: "acessar_leads" },
      { id: "arquivados", label: "Arquivados", href: "/leads/arquivados", permission: "acessar_leads", roles: ["director"] },
    ],
  },
  {
    id: "distribuicao",
    label: "Distribuição",
    fullLabel: "Distribuição de leads, plantões e regras",
    section: "Operação",
    tabs: [
      { id: "hoje", label: "Resumo", href: "/distribuicao", permission: "acessar_qualificacao_ia", roles: ["director", "manager"], paths: ["/distribuicao", "/leads/distribuicao"], cargoCapability: "lead_queues_view" },
      { id: "regras", label: "Entradas e regras", href: "/distribuicao?view=roteamento", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director", "manager"], cargoCapability: "distribution_settings_manage" },
      { id: "operacao", label: "Operação", href: "/distribuicao?view=operar", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director", "manager"], cargoCapability: "leads_assign" },
      { id: "filas", label: "Filas", href: "/distribuicao?view=filas", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director"], cargoCapability: "lead_queues_view" },
      { id: "plantoes", label: "Plantões", href: "/distribuicao?view=plantao", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director", "manager"], paths: ["/leads/distribuicao/plantao"], cargoCapability: "duty_schedules_manage" },
      { id: "saude", label: "Saúde", href: "/distribuicao?view=saude_historico", alsoAt: ["/leads/distribuicao"], permission: "acessar_qualificacao_ia", roles: ["director", "manager"], aliases: { view: ["saude", "historico"] }, cargoCapability: "distribution_audit_view" },
    ],
  },
  {
    id: "comercial",
    label: "Comercial",
    fullLabel: "Negociações, propostas, vendas e clientes",
    section: "Operação",
    tabs: [
      { id: "vendas", label: "Vendas", href: "/vendas", permission: "acessar_vendas" },
      { id: "propostas", label: "Propostas", href: "/propostas", permission: "acessar_vendas" },
      { id: "negociacoes", label: "Negociações", href: "/negociacoes", permission: "ver_dashboard_equipe", requires: "negotiations" },
      // Venda Automatizada (piloto, DEC-182): só com feature_auto_sale_<tenantId> ligada.
      { id: "venda-automatizada", label: "Venda Automatizada", href: "/vendas/automatizada", permission: "acessar_vendas", roles: ["director", "manager"], requires: "autoSale" },
      { id: "clientes", label: "Clientes", href: "/clientes", permission: "acessar_clientes" },
      { id: "documentos", label: "Documentos", href: "/documentos", permission: "acessar_documentos" },
      { id: "comissoes", label: "Comissões", href: "/configuracoes/comissoes", permission: "ver_comissionamento", roles: ["director", "manager"] },
      { id: "ferramentas", label: "Ferramentas", href: "/ferramentas", permission: "acessar_ferramentas", paths: ["/ferramentas/validador-comprovante"] },
    ],
  },
  {
    id: "erp", label: "Operação ERP", fullLabel: "Implantação, financeiro e gestão operacional", section: "Operação",
    tabs: [
      { id: "implantacao", label: "Implantação", href: "/implantacoes", permission: "erp_view_operations", requires: "erp" },
      { id: "financeiro", label: "Financeiro", href: "/financeiro", permission: "erp_view_finance", requires: "erp" },
      { id: "indicacoes", label: "Indicações", href: "/indicacoes", permission: "erp_manage_referrals", requires: "erp" },
      { id: "metas", label: "Metas", href: "/metas", permission: "erp_view_analytics", requires: "erp" },
      { id: "incentivos", label: "Incentivos", href: "/campanhas-incentivo", permission: "erp_view_analytics", requires: "erp" },
      { id: "tv", label: "Modo TV", href: "/tv", permission: "erp_view_analytics", requires: "erp" },
      { id: "importacoes", label: "Importações", href: "/administracao/importacoes", permission: "erp_import_data", requires: "erp" },
      { id: "governanca", label: "Módulos", href: "/administracao/erp", permission: "erp_manage_modules", requires: "erp", roles: ["director"], noCargo: true },
    ],
  },
  {
    id: "equipe",
    label: "Equipe",
    fullLabel: "Equipe, unidades e relacionamento",
    section: "Operação",
    tabs: [
      { id: "pessoas", label: "Pessoas", href: "/equipe", permission: "convidar_corretor", paths: ["/equipe", "/filiais", "/unidades"] },
      { id: "plantoes-unidade", label: "Plantões da unidade", href: "/equipe/plantoes", permission: "convidar_corretor", roles: ["manager"], paths: ["/plantoes/corretor"] },
      { id: "relacionamento", label: "Relacionamento", href: "/relacionamento", permission: "convidar_corretor", requires: "relationshipCenter" },
      { id: "pos-venda", label: "Pós-venda", href: "/equipe/pos-venda", permission: "acessar_leads", roles: ["director", "manager"], requires: "postSaleAudit" },
    ],
  },
  {
    id: "atendimento-ia",
    label: "Atendimento IA",
    fullLabel: "Qualificação por IA, roteiros e mensagens",
    section: "Crescimento",
    tabs: [
      { id: "comportamento", label: "Prompt e comportamento", href: "/qualificacao", permission: "acessar_qualificacao_ia", inPlace: true },
      { id: "permissoes", label: "Permissões", href: "/qualificacao?tab=agent_triggers", permission: "acessar_qualificacao_ia", inPlace: true, aliases: { tab: ["mcp_governance"] } },
      { id: "follow-up", label: "Follow-up", href: "/qualificacao?tab=followup_rules", permission: "acessar_qualificacao_ia", inPlace: true },
      { id: "conectividade", label: "Conectividade", href: "/qualificacao?tab=whatsapp_diag", permission: "acessar_qualificacao_ia", inPlace: true },
      { id: "simulador", label: "Simulador", href: "/qualificacao?tab=simulator", permission: "acessar_qualificacao_ia", inPlace: true, aliases: { tab: ["alerts"] } },
      { id: "turbo", label: "Qualificação turbo", href: "/qualificacao/turbo", permission: "acessar_qualificacao_ia" },
      { id: "situacoes", label: "Situações", href: "/atendimento/situacoes", permission: "acessar_qualificacao_ia", paths: ["/atendimento"] },
      { id: "mensagens", label: "Mensagens", href: "/atendimento/mensagens", permission: "acessar_qualificacao_ia" },
      { id: "perguntas", label: "Fluxo de atendimento", href: "/atendimento/fluxo", permission: "acessar_qualificacao_ia" },
      { id: "fluxos", label: "Fluxos de WhatsApp", href: "/fluxos-whatsapp", permission: "acessar_qualificacao_ia", roles: ["director"] },
      { id: "base", label: "Materiais das operadoras", href: "/ferramentas/materiais-operadoras", permission: "acessar_ferramentas", roles: ["director"] },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    fullLabel: "Campanhas e importação de leads",
    section: "Crescimento",
    tabs: [
      { id: "campanhas", label: "Campanhas", href: "/marketing/campanhas", permission: "acessar_campanhas_meta", paths: ["/marketing"] },
      { id: "importacoes", label: "Importações", href: "/marketing/importacoes", permission: "importar_leads_meta" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    fullLabel: "Conta, empresa, canais e acesso",
    section: "Sistema",
    tabs: [
      { id: "ajustes", label: "Ajustes", href: "/settings", permission: "acessar_configuracoes_pessoais", paths: ["/settings", "/extensao"] },
      { id: "whatsapp", label: "WhatsApp", href: "/integrations/whatsapp", permission: "acessar_configuracoes_pessoais" },
      { id: "integracoes", label: "Integrações", href: "/integrations", permission: "acessar_integracao_meta", paths: ["/integrations/meta", "/guia/webhook"] },
      { id: "cargos", label: "Cargos", href: "/equipe/cargos", permission: "convidar_corretor", roles: ["director"], noCargo: true },
      { id: "recuperacoes", label: "Recuperações de acesso", href: "/equipe/recuperacoes", permission: "convidar_corretor", roles: ["director"], noCargo: true },
    ],
  },
];

function pathOf(href: string) {
  return href.split(/[?#]/, 1)[0] || "/";
}

function queryOf(href: string): Record<string, string> {
  const query = href.split("?")[1]?.split("#")[0];
  return query ? Object.fromEntries(new URLSearchParams(query)) : {};
}

function covers(prefix: string, pathname: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Leitor de query: URLSearchParams e o ReadonlyURLSearchParams do Next servem. */
export type NavSearch = { get(name: string): string | null };

/**
 * Quanto a aba cobre o endereço; 0 quando não cobre. Vence o caminho mais longo; no mesmo caminho,
 * a aba cuja query bate vence a aba sem query (a visão padrão da página).
 */
function tabMatchScore(tab: NavTab, pathname: string, search: NavSearch | null) {
  const own = pathOf(tab.href);
  const query = queryOf(tab.href);
  const keys = Object.keys(query);
  if (keys.length > 0) {
    // Uma aba de query também pode ser dona de outros caminhos (ex.: o detalhe de um plantão).
    const owned = (tab.paths ?? []).filter((candidate) => covers(candidate, pathname)).reduce((longest, candidate) => Math.max(longest, candidate.length), 0);
    if (owned > 0) return owned * 2 + 1;
    const samePage = [own, ...(tab.alsoAt ?? [])].find((candidate) => candidate === pathname);
    if (!samePage) return 0;
    const matches = keys.every((key) => {
      const value = search?.get(key) ?? null;
      return value === query[key] || (value !== null && (tab.aliases?.[key] ?? []).includes(value));
    });
    return matches ? samePage.length * 2 + 1 : 0;
  }
  let best = 0;
  for (const candidate of [own, ...(tab.paths ?? [])]) {
    if (covers(candidate, pathname) && candidate.length * 2 > best) best = candidate.length * 2;
  }
  return best;
}

export type NavMatch = { area: NavArea; tab: NavTab };

/** Área e aba de um endereço: vence o caminho mais específico entre todas as abas. */
export function resolveNavLocation(pathname: string, search: NavSearch | null = null): NavMatch | null {
  const [rawPath, rawQuery] = pathname.split("?");
  const path = (rawPath || "/").replace(/(.)\/+$/, "$1");
  const query = search ?? (rawQuery ? new URLSearchParams(rawQuery) : null);
  let found: NavMatch | null = null;
  let bestScore = 0;
  for (const area of NAV_AREAS) {
    for (const tab of area.tabs) {
      const score = tabMatchScore(tab, path, query);
      if (score > bestScore) {
        bestScore = score;
        found = { area, tab };
      }
    }
  }
  return found;
}

export type NavAccessUser = NavigationAccessUser & { negotiationsEnabled?: boolean; postSaleAuditEnabled?: boolean; autoSaleEnabled?: boolean; erpPaths?: readonly string[] };

export function canShowNavTab(tab: NavTab, user: NavAccessUser | null) {
  if (!user?.roleKey) return false;
  if (tab.roles && !tab.roles.includes(user.roleKey)) return false;
  // This allowlist is built by the server's module + cargo + resource-scope guards.
  // It is also the narrow exception to the manager's unchanged legacy menu boundary.
  if (tab.requires === "erp") return user.erpPaths?.includes(pathOf(tab.href)) === true;
  if (tab.requires === "negotiations" && !user.negotiationsEnabled) return false;
  if (tab.requires === "postSaleAudit" && !user.postSaleAuditEnabled) return false;
  if (tab.requires === "autoSale" && !user.autoSaleEnabled) return false;
  // Cargo (04/11, F2): as permissões trazem rotas "route:" só para quem tem cargo; aí a aba exige a capacidade.
  const permissions = user.permissions ?? [];
  const hasCargo = permissions.some((permission) => permission.startsWith("route:"));
  if (tab.noCargo && hasCargo) return false;
  if (tab.cargoCapability && hasCargo && !permissions.includes(tab.cargoCapability)) return false;
  return canShowNavigationItem({ url: tab.href, permission: tab.permission, requires: tab.requires === "relationshipCenter" ? "relationshipCenter" : undefined }, user);
}

export function visibleNavTabs(area: NavArea, user: NavAccessUser | null) {
  return area.tabs.filter((tab) => canShowNavTab(tab, user));
}

/** Áreas que o usuário enxerga, cada uma com o destino da primeira aba visível. */
export function visibleNavAreas(user: NavAccessUser | null) {
  return NAV_AREAS.flatMap((area) => {
    const tabs = visibleNavTabs(area, user);
    return tabs.length > 0 ? [{ area, tabs, href: tabs[0].href }] : [];
  });
}

/** Caminhos que são raiz de uma aba: no chrome do diretor não mostram "voltar". */
export function isNavTabRoot(pathname: string) {
  const path = pathOf(pathname).replace(/(.)\/+$/, "$1");
  return NAV_AREAS.some((area) => area.tabs.some((tab) => pathOf(tab.href) === path));
}
