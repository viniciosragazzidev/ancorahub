import type { AcoesGaveta } from "../panel/gaveta";
import type { EstadoGaveta, Temperatura } from "../shared/types";
import { localizarTodas } from "./detectors";
import { aplicarTema, observarTema } from "./tema";

// Contrato do módulo do painel (panel/panel.js, carregado como recurso acessível pela web).
export type SeloCabecalho = { etapa: string; temperatura?: Temperatura };
type ControleGaveta = { atualizar(estado: EstadoGaveta): void; desmontar(): void };
type ControleSelo = { atualizar(selo: SeloCabecalho | null): void; desmontar(): void };
type ModuloPainel = {
  montarPainel(shadow: ShadowRoot, acoes: AcoesGaveta, estado?: EstadoGaveta): ControleGaveta;
  montarSelo(shadow: ShadowRoot, onAbrir: () => void): ControleSelo;
};

let modulo: Promise<ModuloPainel> | null = null;
/** Carrega o painel React sob demanda. Sem o módulo, o WhatsApp segue intacto e nada aparece. */
function carregarModulo(): Promise<ModuloPainel> {
  modulo ??= import(/* @vite-ignore */ chrome.runtime.getURL("panel/panel.js")) as Promise<ModuloPainel>;
  return modulo;
}

// Largura da coluna nativa "Dados do contato" no WhatsApp Web (desktop).
const LARGURA_GAVETA = 415;

const ESTILO_BOTAO = `:host{display:inline-flex}
button{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:999px;background:transparent;color:var(--ct-fg,#111b21);cursor:pointer}
button:hover,button:focus-visible{background:var(--ct-hover,#f0f2f5);outline:0}
.marca{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:oklch(62% .2 255);color:#fff;font:700 12px/1 "Inter Variable",Inter,system-ui,sans-serif}
@media (prefers-reduced-motion: reduce){button{transition:none}}`;

type Acoes = Omit<AcoesGaveta, "fechar">;

export type PainelWhatsApp = {
  mostrar(estado: EstadoGaveta, selo: SeloCabecalho | null): void;
  ocultar(): void;
  /** A gaveta está aberta agora (o aviso de conexão só aparece com ela fechada). */
  aberta(): boolean;
};

type Hospedeiro = { host: HTMLElement; shadow: ShadowRoot };

function criarHospedeiro(id: string, estilo: string, posicao: string): Hospedeiro {
  const host = document.createElement("div");
  host.id = id;
  host.setAttribute("style", posicao);
  const shadow = host.attachShadow({ mode: "closed" });
  const css = document.createElement("style");
  css.textContent = estilo;
  shadow.append(css);
  return { host, shadow };
}

/**
 * Painel do WhatsApp Web: coluna "Dados do lead" (encostada à direita), botão na barra esquerda e selo no
 * cabeçalho da conversa. Com a área da conversa identificada, a coluna empurra a conversa (margem à direita,
 * revertida ao fechar). Sem âncora confiável, vira sobreposição. Cada parte só aparece se o detector achar o alvo.
 * Devolve null se o módulo do painel não carregar (o WhatsApp segue intacto).
 */
export async function criarPainelWhatsApp(acoes: Acoes): Promise<PainelWhatsApp | null> {
  let modulos: ModuloPainel;
  try {
    modulos = await carregarModulo();
  } catch {
    return null;
  }

  let gavetaAberta = false;
  let ultimoSelo: SeloCabecalho | null = null;
  let seloHost: Hospedeiro | null = null;
  let controleSelo: ControleSelo | null = null;
  let botao: HTMLElement | null = null;
  // Conversa empurrada: guarda a margem original do WhatsApp para devolver ao fechar.
  let conversaEmpurrada: { elemento: HTMLElement; margemAnterior: string } | null = null;

  const gaveta = criarHospedeiro("ancorahub-gaveta", "", "position:fixed;top:0;right:0;height:100%;width:" + LARGURA_GAVETA + "px;max-width:40vw;border-left:1px solid var(--ct-line,#e9edef);z-index:2147483640;display:none;");
  document.body.append(gaveta.host);

  // Âncora confiável: a área da conversa identificada pelo adaptador. Sem ela, a gaveta só sobrepõe.
  function ancoraConversa(): HTMLElement | null {
    const elemento = document.querySelector<HTMLElement>('[data-testid="conversation-panel-wrapper"]');
    return elemento && elemento.getClientRects().length > 0 ? elemento : null;
  }

  function posicionar() {
    const ancora = ancoraConversa();
    if (!ancora) {
      devolverConversa();
      gaveta.host.style.top = "0";
      gaveta.host.style.height = "100%";
      return;
    }
    const retangulo = ancora.getBoundingClientRect();
    gaveta.host.style.top = `${retangulo.top}px`;
    gaveta.host.style.height = `${retangulo.height}px`;
    if (!conversaEmpurrada || conversaEmpurrada.elemento !== ancora) {
      devolverConversa();
      conversaEmpurrada = { elemento: ancora, margemAnterior: ancora.style.marginRight };
    }
    ancora.style.marginRight = `${LARGURA_GAVETA}px`;
  }

  function devolverConversa() {
    if (!conversaEmpurrada) return;
    conversaEmpurrada.elemento.style.marginRight = conversaEmpurrada.margemAnterior;
    conversaEmpurrada = null;
  }

  const alternarGaveta = (abrir?: boolean) => {
    gavetaAberta = abrir ?? !gavetaAberta;
    gaveta.host.style.display = gavetaAberta ? "block" : "none";
    if (gavetaAberta) posicionar();
    else devolverConversa();
  };

  window.addEventListener("resize", () => { if (gavetaAberta) posicionar(); });

  const controleGaveta = modulos.montarPainel(gaveta.shadow, { ...acoes, fechar: () => alternarGaveta(false) });

  // Vive junto com o painel: não é cancelado no ocultar, senão o tema para de acompanhar o WhatsApp.
  observarTema((tema) => {
    aplicarTema(gaveta.host, tema);
    if (seloHost) aplicarTema(seloHost.host, tema);
    if (botao) aplicarTema(botao, tema);
  });

  function garantirSelo() {
    const cabecalho = localizarTodas(document).cabecalho;
    if (cabecalho.estado !== "ok") {
      seloHost?.host.remove();
      seloHost = null;
      controleSelo?.desmontar();
      controleSelo = null;
      return;
    }
    if (seloHost && seloHost.host.parentElement === cabecalho.elemento) return;
    seloHost?.host.remove();
    controleSelo?.desmontar();
    // margem à esquerda: o selo não encosta no nome do contato.
    seloHost = criarHospedeiro("ancorahub-selo", "", "display:inline-flex;align-items:center;margin-left:12px;");
    cabecalho.elemento.append(seloHost.host);
    controleSelo = modulos.montarSelo(seloHost.shadow, () => alternarGaveta(true));
    controleSelo.atualizar(ultimoSelo);
  }

  function garantirBotao() {
    const barra = localizarTodas(document).barraEsquerda;
    if (barra.estado !== "ok") {
      botao?.remove();
      botao = null;
      return;
    }
    if (botao && botao.parentElement === barra.elemento) return;
    botao?.remove();
    const { host, shadow } = criarHospedeiro("ancorahub-botao", ESTILO_BOTAO, "display:inline-flex;");
    const control = document.createElement("button");
    control.type = "button";
    control.setAttribute("aria-label", "AncoraHub Assistant");
    control.title = "AncoraHub Assistant";
    control.innerHTML = '<span class="marca" aria-hidden="true">A</span>';
    control.addEventListener("click", () => alternarGaveta());
    shadow.append(control);
    barra.elemento.append(host);
    botao = host;
  }

  return {
    mostrar(estado, selo) {
      ultimoSelo = selo;
      garantirBotao();
      garantirSelo();
      controleSelo?.atualizar(selo);
      controleGaveta.atualizar(estado);
      if (gavetaAberta) posicionar();
    },
    ocultar() {
      ultimoSelo = null;
      alternarGaveta(false);
      seloHost?.host.remove();
      seloHost = null;
      controleSelo?.desmontar();
      controleSelo = null;
      botao?.remove();
      botao = null;
      controleGaveta.atualizar({ tipo: "sem-lead" });
    },
    aberta: () => gavetaAberta,
  };
}
