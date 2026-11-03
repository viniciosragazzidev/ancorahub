// Ponte de tema: lê a superfície efetiva do WhatsApp Web e expõe variáveis --ct-* no host do shadow root.
// As cores de ação (Lite) vêm dos tokens do próprio painel, não daqui.

export type Tema = "claro" | "escuro";

export type Cor = { rgb: [number, number, number]; alfa: number };

/** Lê rgb()/rgba() com alfa. Cor não reconhecida devolve null. */
export function corParaRgba(cor: string): Cor | null {
  const encontrado = cor.match(/^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,\/]+([\d.]+%?))?\)?/);
  if (!encontrado) return null;
  const alfaBruto = encontrado[4];
  const alfa = alfaBruto === undefined ? 1 : alfaBruto.endsWith("%") ? Number(alfaBruto.slice(0, -1)) / 100 : Number(alfaBruto);
  return { rgb: [Number(encontrado[1]), Number(encontrado[2]), Number(encontrado[3])], alfa };
}

export function corParaRgb(cor: string): [number, number, number] | null {
  return corParaRgba(cor)?.rgb ?? null;
}

/** Luminância aproximada em 0..1 (peso de percepção). */
export function luminancia([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Só superfície pintada conta: alfa abaixo de 0,5 é transparente para o tema. */
const PINTADA = 0.5;

/** Cor não reconhecida ou transparente cai no claro, que é o padrão do WhatsApp. */
export function temaPelaCor(cor: string): Tema {
  const lida = corParaRgba(cor);
  if (!lida || lida.alfa < PINTADA) return "claro";
  return luminancia(lida.rgb) < 0.5 ? "escuro" : "claro";
}

/**
 * Superfície efetiva: sobe pelos ancestrais a partir do elemento até achar fundo pintado.
 * Um body transparente (comum no WhatsApp) não decide o tema; o fundo do app decide.
 */
export function corEfetiva(elemento: Element | null): string | null {
  for (let atual = elemento; atual; atual = atual.parentElement) {
    const cor = getComputedStyle(atual).backgroundColor;
    const lida = corParaRgba(cor);
    if (lida && lida.alfa >= PINTADA) return cor;
  }
  return null;
}

export function variaveisDoTema(tema: Tema): Record<string, string> {
  return tema === "escuro"
    ? { "--ct-bg": "#111b21", "--ct-fg": "#e9edef", "--ct-muted": "#8696a0", "--ct-surface": "#202c33", "--ct-line": "#2a3942", "--ct-action": "oklch(70% .17 255)", "--ct-warning": "oklch(78% .13 75)", "--ct-danger": "oklch(72% .17 25)" }
    : { "--ct-bg": "#ffffff", "--ct-fg": "#111b21", "--ct-muted": "#667781", "--ct-surface": "#f0f2f5", "--ct-line": "#e9edef", "--ct-action": "oklch(62% .2 255)", "--ct-warning": "#a15c00", "--ct-danger": "#d4263a" };
}

export function aplicarTema(host: HTMLElement, tema: Tema) {
  for (const [nome, valor] of Object.entries(variaveisDoTema(tema))) host.style.setProperty(nome, valor);
}

/** Observa a troca de tema do WhatsApp e chama o callback com o tema da superfície efetiva. */
export function observarTema(callback: (tema: Tema) => void): () => void {
  const ler = () => {
    const alvo = document.querySelector("#app") ?? document.body;
    callback(temaPelaCor(corEfetiva(alvo) ?? "transparent"));
  };
  const observer = new MutationObserver(ler);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
  ler();
  return () => observer.disconnect();
}
