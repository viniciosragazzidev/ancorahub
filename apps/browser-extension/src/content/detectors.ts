// Registro de detectores por capacidade. Cada capacidade tem alternativas em ordem de prioridade:
// data-testid (mais estável), depois aria-label em PT e EN. Só age quando o alvo é único e visível;
// se uma capacidade falha, só ela some e o resto segue.

export type Capacidade = "shell" | "barraEsquerda" | "cabecalho" | "composer" | "gaveta" | "linhaChat";

export type Detector = { capacidade: Capacidade; alternativas: readonly string[] };

export const DETECTORES: readonly Detector[] = [
  { capacidade: "shell", alternativas: ['[data-testid="wa-web-main-screen"]'] },
  // Não validado contra HTML real: confirmar com captura sanitizada (E6). Ver README da extensão.
  { capacidade: "barraEsquerda", alternativas: ['nav[aria-label="Navegação"]', 'nav[aria-label="Navigation"]'] },
  { capacidade: "cabecalho", alternativas: ['[data-testid="conversation-header"]'] },
  {
    capacidade: "composer",
    alternativas: [
      '[data-testid="conversation-compose-box-input"]',
      'div[contenteditable="true"][aria-label="Digite uma mensagem"]',
      'div[contenteditable="true"][aria-label="Type a message"]',
    ],
  },
  { capacidade: "gaveta", alternativas: ['[data-testid="drawer-right"]'] },
  // Não validado contra HTML real: confirmar com captura sanitizada (E6).
  { capacidade: "linhaChat", alternativas: ['[data-testid="cell-frame-container"]'] },
];

export type Achado =
  | { estado: "ok"; elemento: Element }
  | { estado: "ausente" | "ambigua" | "oculta" | "desligada" };

export type OpcoesLocalizar = {
  /** Capacidades que o super admin desligou (extension_settings). */
  desligadas?: ReadonlySet<Capacidade>;
  /** Teste de visibilidade. Padrão: o elemento ocupa espaço na tela. */
  visivel?: (elemento: Element) => boolean;
};

const visivelNaTela = (elemento: Element) =>
  elemento.getClientRects().length > 0 && getComputedStyle(elemento).visibility !== "hidden";

export function localizar(raiz: ParentNode, detector: Detector, opcoes: OpcoesLocalizar = {}): Achado {
  if (opcoes.desligadas?.has(detector.capacidade)) return { estado: "desligada" };
  const visivel = opcoes.visivel ?? visivelNaTela;
  for (const seletor of detector.alternativas) {
    const achados = raiz.querySelectorAll(seletor);
    if (achados.length === 0) continue;
    // Mais de um alvo: agir no errado é pior que não agir. Para e não tenta a próxima alternativa.
    if (achados.length > 1) return { estado: "ambigua" };
    const elemento = achados[0];
    if (!visivel(elemento)) return { estado: "oculta" };
    return { estado: "ok", elemento };
  }
  return { estado: "ausente" };
}

export function localizarTodas(raiz: ParentNode, opcoes: OpcoesLocalizar = {}): Record<Capacidade, Achado> {
  return Object.fromEntries(DETECTORES.map((detector) => [detector.capacidade, localizar(raiz, detector, opcoes)])) as Record<Capacidade, Achado>;
}

/** Capacidades que podem ser usadas agora. A interface oferece só essas e mostra "Abrir no CRM" no resto. */
export function capacidadesDisponiveis(achados: Record<Capacidade, Achado>): Set<Capacidade> {
  return new Set((Object.keys(achados) as Capacidade[]).filter((capacidade) => achados[capacidade].estado === "ok"));
}
