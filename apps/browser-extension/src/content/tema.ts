// Ponte de tema: lê o fundo do WhatsApp Web e expõe variáveis --ct-* no host do shadow root.
// As cores de ação (Lite) vêm dos tokens do próprio painel, não daqui.

export type Tema = "claro" | "escuro";

export function corParaRgb(cor: string): [number, number, number] | null {
  const encontrado = cor.match(/^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  return encontrado ? [Number(encontrado[1]), Number(encontrado[2]), Number(encontrado[3])] : null;
}

/** Luminância aproximada em 0..1 (peso de percepção). */
export function luminancia([r, g, b]: [number, number, number]): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Cor não reconhecida (ex.: "transparent") cai no claro, que é o padrão do WhatsApp. */
export function temaPelaCor(cor: string): Tema {
  const rgb = corParaRgb(cor);
  if (!rgb) return "claro";
  return luminancia(rgb) < 0.5 ? "escuro" : "claro";
}

export function variaveisDoTema(tema: Tema): Record<string, string> {
  return tema === "escuro"
    ? { "--ct-bg": "#111b21", "--ct-fg": "#e9edef", "--ct-muted": "#8696a0", "--ct-surface": "#202c33", "--ct-line": "#2a3942" }
    : { "--ct-bg": "#ffffff", "--ct-fg": "#111b21", "--ct-muted": "#667781", "--ct-surface": "#f0f2f5", "--ct-line": "#e9edef" };
}

export function aplicarTema(host: HTMLElement, tema: Tema) {
  for (const [nome, valor] of Object.entries(variaveisDoTema(tema))) host.style.setProperty(nome, valor);
}

/** Observa a troca de tema do WhatsApp (classe ou atributo no html/body) e chama o callback com o tema atual. */
export function observarTema(callback: (tema: Tema) => void): () => void {
  const ler = () => callback(temaPelaCor(getComputedStyle(document.body).backgroundColor));
  const observer = new MutationObserver(ler);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style"] });
  ler();
  return () => observer.disconnect();
}
