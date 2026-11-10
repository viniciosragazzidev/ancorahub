/**
 * Gestor na versão antiga (10/11/2026): o gestor usa o modo normal (sem o Lite do gestor e sem o visual Lite do
 * diretor) e só enxerga a gestão da própria unidade. Fonte única das rotas que ele pode abrir; o menu lateral, o
 * layout do painel e os layouts de cada área leem daqui. Tudo que não está aqui é negado no servidor (fail closed).
 * Decisão do Vinicios: sem configuração do sistema, distribuição, conversas de qualificação, comercial, lista geral
 * de leads, marketing, atendimento IA e pós-venda (pós-venda volta depois).
 * Plano: docs/implementations/active/2026-11-10-gestor-versao-antiga-escopo-unidade.md
 */

const ID = "[^/]+";

/** Rotas que o gestor abre. Cada uma confere a unidade da sessão na própria página. */
export const MANAGER_ALLOWED_ROUTES: readonly RegExp[] = [
  /^\/dashboard$/,
  /^\/equipe$/,
  /^\/equipe\/plantoes$/,
  /^\/equipe\/convidar$/,
  new RegExp(`^/equipe/(?!cargos$|convidar$|dashboard$|recuperacoes$|pos-venda$|minha$|plantao$|plantoes$|repassar$|transferencia$|desempenho$)${ID}$`),
  new RegExp(`^/unidades/${ID}$`),
  new RegExp(`^/plantoes/corretor/${ID}$`),
  // Lead da unidade aberto a partir do perfil do corretor (a página confere a unidade do lead).
  new RegExp(`^/leads/(?!dashboard$|arquivados$|distribuicao$|novo$|importar$)${ID}$`),
  /^\/notificacoes$/,
  /^\/settings$/,
  /^\/primeiro-acesso(\/.*)?$/,
  /^\/welcome(\/.*)?$/,
  /^\/access-denied$/,
  /^\/not-found$/,
];

function pathOnly(pathname: string) {
  const path = (pathname.split(/[?#]/, 1)[0] || "/").replace(/(.)\/+$/, "$1");
  return path;
}

/** O gestor pode abrir este endereço? Caminho vazio (sem cabeçalho) fica a cargo da página. */
export function isManagerRouteAllowed(pathname: string): boolean {
  const path = pathOnly(pathname);
  return MANAGER_ALLOWED_ROUTES.some((route) => route.test(path));
}

/** Primeira tela do gestor: a equipe da unidade. */
export const MANAGER_HOME_PATH = "/equipe";

/** Abas de Ajustes que o gestor vê: só a própria conta e a segurança (nada da empresa, unidade ou atendimento). */
export const MANAGER_SETTINGS_TABS = ["conta", "seguranca"] as const;

/** Funções com papel "manager" que NÃO são gestor de unidade (marketing e financeiro usam o papel manager). */
const NON_UNIT_MANAGER_JOB_TITLES: ReadonlySet<string> = new Set(["marketing", "finance"]);

/**
 * É o gestor de unidade, que perdeu as áreas de sistema (distribuição, atendimento IA, marketing, integrações,
 * configuração) em 10/11? Papel manager, fora das funções marketing e financeiro. Sem a função informada, conta
 * como gestor (fail closed). Função comum (sem estreitar o tipo do papel) para entrar antes das checagens antigas.
 */
export function isOutsideManagerScope(role: string, jobTitle?: string | null): boolean {
  return role === "manager" && !(jobTitle && NON_UNIT_MANAGER_JOB_TITLES.has(jobTitle));
}

export const MANAGER_DISTRIBUTION_REFUSAL = "A distribuição e os plantões são geridos pelo diretor. O gestor acompanha os plantões da unidade.";
