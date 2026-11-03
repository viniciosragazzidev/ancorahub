import { createRoot, type Root } from "react-dom/client";
import tokensAtivos from "../../../../src/components/arc/venancor-scope.css";
import tokensBase from "../../../../src/components/arc/foundation.css";
import type { EstadoGaveta, Temperatura } from "../shared/types";
import { Gaveta, type AcoesGaveta } from "./gaveta";
import { ESTILO_GAVETA } from "./estilo-gaveta";
import { rotuloTemperatura } from "./formatos";

// Os tokens do Arc declaram :root, que não existe dentro de um shadow root. Viram :host.
const noShadow = (css: string) => css.replaceAll(":root", ":host");

const ESTILO_SELO = `
:host{--ct-bg:#ffffff;--ct-fg:#0b0b12;--ct-muted:#666674;--ct-line:rgb(16 16 40 / .08);--ct-action:oklch(62% .2 255)}
.selo{display:inline-flex;align-items:center;gap:6px;max-width:100%;height:24px;padding:0 10px;border:1px solid var(--ct-line);border-radius:999px;background:var(--ct-bg);color:var(--ct-fg);font:600 11px/1 "Inter Variable",Inter,system-ui,sans-serif;cursor:pointer}
.ponto{width:8px;height:8px;border-radius:999px;background:var(--ct-muted);flex:none}
.selo[data-t="quente"] .ponto{background:oklch(58% .2 30)}
.selo[data-t="morno"] .ponto{background:oklch(70% .15 75)}
.selo[data-t="frio"] .ponto{background:oklch(62% .15 255)}
.selo span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:focus-visible{outline:2px solid var(--ct-action);outline-offset:2px}
@media (prefers-reduced-motion: reduce){.selo{transition:none}}
`;

function montarRaiz(shadow: ShadowRoot, css: string): Root {
  const estilo = document.createElement("style");
  estilo.textContent = css;
  const ponto = document.createElement("div");
  shadow.append(estilo, ponto);
  return createRoot(ponto);
}

export type ControleGaveta = { atualizar(estado: EstadoGaveta): void; desmontar(): void };

/** Monta a gaveta no shadow root e devolve o controle para o script de conteúdo trocar o estado. */
export function montarPainel(shadow: ShadowRoot, acoes: AcoesGaveta, estadoInicial: EstadoGaveta = { tipo: "carregando" }): ControleGaveta {
  const raiz = montarRaiz(shadow, `${noShadow(tokensBase)}\n${tokensAtivos}\n${ESTILO_GAVETA}`);
  const desenhar = (estado: EstadoGaveta) => raiz.render(<Gaveta estado={estado} acoes={acoes} />);
  desenhar(estadoInicial);
  return {
    atualizar: desenhar,
    desmontar: () => raiz.unmount(),
  };
}

export type SeloCabecalho = { etapa: string; temperatura?: Temperatura };
export type ControleSelo = { atualizar(selo: SeloCabecalho | null): void; desmontar(): void };

function Selo({ selo, onAbrir }: { selo: SeloCabecalho; onAbrir(): void }) {
  const t = selo.temperatura ?? "sem-dados";
  return (
    <button className="selo" type="button" data-t={t} aria-label={`${selo.etapa}, temperatura ${rotuloTemperatura(t)}. Abrir resumo`} onClick={onAbrir}>
      <span className="ponto" aria-hidden="true" />
      <span>{selo.etapa} · {rotuloTemperatura(t)}</span>
    </button>
  );
}

/** Selo de etapa e temperatura no cabeçalho da conversa aberta. Abre a gaveta ao clicar. */
export function montarSelo(shadow: ShadowRoot, onAbrir: () => void): ControleSelo {
  const raiz = montarRaiz(shadow, ESTILO_SELO);
  const desenhar = (selo: SeloCabecalho | null) => raiz.render(selo ? <Selo selo={selo} onAbrir={onAbrir} /> : null);
  desenhar(null);
  return { atualizar: desenhar, desmontar: () => raiz.unmount() };
}
