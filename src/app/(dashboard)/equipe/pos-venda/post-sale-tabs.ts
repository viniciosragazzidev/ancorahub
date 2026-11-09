/** Abas da tela Equipe › Pós-venda, no valor que vai para `?aba=`. */
export const POST_SALE_TABS = ["visao-geral", "respostas", "campanhas", "automacoes"] as const;
export type PostSaleTab = (typeof POST_SALE_TABS)[number];

export const POST_SALE_TAB_LABELS: Record<PostSaleTab, string> = {
  "visao-geral": "Visão geral",
  respostas: "Respostas",
  campanhas: "Campanhas",
  automacoes: "Automações",
};

/** `?aba=` inválida ou ausente abre a Visão geral; com leads escolhidos na lista (`leadIds`), abre Campanhas. */
export function parsePostSaleTab(value: string | string[] | undefined, hasLeadSelection = false): PostSaleTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && (POST_SALE_TABS as readonly string[]).includes(raw)) return raw as PostSaleTab;
  return hasLeadSelection ? "campanhas" : "visao-geral";
}

/** A mesma URL com a aba trocada, sem perder os outros parâmetros (período, leads). A Visão geral não leva `aba`. */
export function postSaleTabHref(currentSearch: string, tab: PostSaleTab, pathname = "/equipe/pos-venda") {
  const params = new URLSearchParams(currentSearch);
  if (tab === "visao-geral") params.delete("aba");
  else params.set("aba", tab);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
