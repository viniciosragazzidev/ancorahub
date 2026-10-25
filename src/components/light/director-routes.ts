/** Títulos e destinos de retorno do chrome do diretor, sem alterar rotas. */
export type DirectorRoute = {
  title: string;
  parentHref: string | null;
};

type RouteRule = {
  test: (pathname: string) => boolean;
  route: DirectorRoute | ((pathname: string) => DirectorRoute);
};

const exact = (path: string) => (pathname: string) => pathname === path;
const detailSegment = (pattern: RegExp, title: string, parentHref: string | ((pathname: string) => string)): RouteRule => ({
  test: (pathname) => pattern.test(pathname),
  route: (pathname) => ({ title, parentHref: typeof parentHref === "function" ? parentHref(pathname) : parentHref }),
});
const detail = (pattern: RegExp, title: string, parent: (pathname: string) => string): RouteRule => ({
  test: (pathname) => pattern.test(pathname),
  route: (pathname) => ({ title, parentHref: parent(pathname) }),
});

const ROUTES: readonly RouteRule[] = [
  detail(/^\/leads\/[^/]+\/feedback$/, "Atualização do lead", (path) => path.replace(/\/feedback$/, "")),
  detailSegment(/^\/leads\/(?!arquivados$|dashboard$|distribuicao$)[^/]+$/, "Lead", "/leads"),
  detail(/^\/clientes\/[^/]+$/, "Cliente", () => "/clientes"),
  detailSegment(/^\/vendas\/(?!dashboard$)[^/]+$/, "Venda", "/vendas"),
  detailSegment(/^\/equipe\/(?!cargos$|convidar$|recuperacoes$|desempenho$|plantao$|repassar$|transferencia$|minha$|dashboard$)[^/]+$/, "Perfil do corretor", "/equipe"),
  detail(/^\/gestao\/equipes\/[^/]+$/, "Equipe", () => "/gestao"),
  detail(/^\/unidades\/[^/]+$/, "Unidade", () => "/equipe?visao=unidades"),
  detail(/^\/marketing\/campanhas\/[^/]+$/, "Campanha", () => "/marketing/campanhas"),
  detail(/^\/relatorios\/drill\/[^/]+$/, "Detalhe do relatório", () => "/relatorios"),
  detail(/^\/dashboard\/drill\/[^/]+$/, "Detalhe do painel", () => "/dashboard"),
  detail(/^\/leads\/distribuicao\/plantao\/[^/]+$/, "Plantão", () => "/distribuicao?view=plantao"),
  detail(/^\/plantoes\/corretor\/[^/]+$/, "Plantão do corretor", () => "/plantoes"),
  { test: exact("/equipe/cargos"), route: { title: "Cargos", parentHref: "/equipe" } },
  { test: exact("/equipe/convidar"), route: { title: "Convidar corretor", parentHref: "/equipe" } },
  { test: exact("/equipe/recuperacoes"), route: { title: "Recuperações", parentHref: "/equipe" } },
  { test: exact("/equipe/desempenho"), route: { title: "Desempenho da equipe", parentHref: "/equipe" } },
  { test: exact("/equipe/plantao"), route: { title: "Plantão da equipe", parentHref: "/equipe" } },
  { test: exact("/equipe/repassar"), route: { title: "Repassar leads", parentHref: "/equipe" } },
  { test: exact("/equipe/transferencia"), route: { title: "Transferir corretor", parentHref: "/equipe" } },
  { test: exact("/equipe/minha"), route: { title: "Minha equipe", parentHref: "/equipe" } },
  { test: exact("/dashboard"), route: { title: "Início", parentHref: null } },
  { test: exact("/leads"), route: { title: "Leads", parentHref: null } },
  { test: exact("/conversas"), route: { title: "Conversas", parentHref: null } },
  { test: exact("/equipe"), route: { title: "Equipe", parentHref: null } },
  { test: exact("/distribuicao"), route: { title: "Distribuição", parentHref: null } },
  { test: exact("/plantoes"), route: { title: "Plantões", parentHref: null } },
  { test: exact("/plantoes/agora"), route: { title: "Plantões", parentHref: null } },
  { test: exact("/qualificacao"), route: { title: "Qualificação", parentHref: null } },
  { test: exact("/integrations/whatsapp"), route: { title: "WhatsApp", parentHref: null } },
  { test: exact("/marketing/campanhas"), route: { title: "Campanhas", parentHref: null } },
  { test: exact("/notificacoes"), route: { title: "Notificações", parentHref: null } },
  { test: exact("/settings"), route: { title: "Configurações", parentHref: null } },
  { test: exact("/relatorios"), route: { title: "Relatórios", parentHref: null } },
  { test: exact("/agenda"), route: { title: "Agenda", parentHref: null } },
  { test: exact("/desempenho"), route: { title: "Desempenho", parentHref: null } },
  { test: exact("/minha-fila"), route: { title: "Minha fila", parentHref: null } },
];

function titleFromPath(pathname: string) {
  const finalSegment = pathname.split("/").filter(Boolean).at(-1);
  if (!finalSegment) return "AncoraHub";
  const sentence = finalSegment.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
  return sentence.charAt(0).toLocaleUpperCase("pt-BR") + sentence.slice(1);
}

/** Retorna pai apenas para detalhes conhecidos; abas e telas principais mantêm o menu. */
export function resolveDirectorRoute(pathname: string): DirectorRoute {
  const normalized = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  const match = ROUTES.find((rule) => rule.test(normalized));
  if (!match) return { title: titleFromPath(normalized), parentHref: null };
  return typeof match.route === "function" ? match.route(normalized) : match.route;
}
