import { createRoot, type Root } from "react-dom/client";
import tokensAtivos from "../../../../src/components/arc/venancor-scope.css";
import tokensBase from "../../../../src/components/arc/foundation.css";
import type { AvisoInboxExtensao, EstadoGaveta, Temperatura } from "../shared/types";
import { Gaveta, type AcoesGaveta } from "./gaveta";
import { ESTILO_GAVETA } from "./estilo-gaveta";
import { rotuloTemperatura } from "./formatos";
import { AvisoInbox } from "./aviso-inbox";
import { ESTILO_HISTORICO, HistoricoQualificacao, type DadosHistorico } from "./historico-qualificacao";

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

/** `altura`: a raiz ocupa a altura do hospedeiro, para a coluna da gaveta rolar só dentro de si. */
function montarRaiz(shadow: ShadowRoot, css: string, altura = false): Root {
  const estilo = document.createElement("style");
  estilo.textContent = css;
  const ponto = document.createElement("div");
  if (altura) ponto.style.height = "100%";
  shadow.append(estilo, ponto);
  return createRoot(ponto);
}

export type ControleGaveta = { atualizar(estado: EstadoGaveta): void; atualizarOfertas(offerId?: string): void; definirAberta(aberta: boolean): void; desmontar(): void };

/** Monta a gaveta no shadow root e devolve o controle para o script de conteúdo trocar o estado. */
export function montarPainel(shadow: ShadowRoot, acoes: AcoesGaveta, estadoInicial: EstadoGaveta = { tipo: "carregando" }): ControleGaveta {
  const raiz = montarRaiz(shadow, `${noShadow(tokensBase)}\n${tokensAtivos}\n${ESTILO_GAVETA}`, true);
  let estado = estadoInicial;
  let ativa = false;
  let refreshKey = 0;
  let destacarOfferId: string | null = null;
  const desenhar = () => raiz.render(<Gaveta estado={estado} acoes={acoes} refreshKey={refreshKey} destacarOfferId={destacarOfferId} ativa={ativa} />);
  desenhar();
  return {
    atualizar(novoEstado) { estado = novoEstado; desenhar(); },
    atualizarOfertas(offerId) { destacarOfferId = offerId ?? null; refreshKey += 1; desenhar(); },
    definirAberta(aberta) { ativa = aberta; desenhar(); },
    desmontar: () => raiz.unmount(),
  };
}

export type ControleAvisoInbox = { atualizar(aviso: AvisoInboxExtensao | null): void; desmontar(): void };

export function montarAvisoInbox(shadow: ShadowRoot, onAbrir: (aviso: AvisoInboxExtensao) => void): ControleAvisoInbox {
  const raiz = montarRaiz(shadow, "*{box-sizing:border-box}");
  let aviso: AvisoInboxExtensao | null = null;
  const desenhar = () => raiz.render(<AvisoInbox aviso={aviso} onAbrir={onAbrir} onFechar={() => { aviso = null; desenhar(); }} />);
  desenhar();
  return { atualizar(novoAviso) { aviso = novoAviso; desenhar(); }, desmontar: () => raiz.unmount() };
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

export type ControleHistorico = { atualizar(historico: DadosHistorico | null): void; desmontar(): void };

/** Histórico da qualificação, dentro da conversa do lead. `null` tira tudo (outra conversa ou sem lead). */
export function montarHistorico(shadow: ShadowRoot): ControleHistorico {
  const raiz = montarRaiz(shadow, ESTILO_HISTORICO);
  const desenhar = (historico: DadosHistorico | null) => raiz.render(historico ? <HistoricoQualificacao historico={historico} /> : null);
  desenhar(null);
  return { atualizar: desenhar, desmontar: () => raiz.unmount() };
}
