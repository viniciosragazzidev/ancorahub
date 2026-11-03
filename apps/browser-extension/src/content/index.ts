import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { criarPainelWhatsApp, type PainelWhatsApp, type SeloCabecalho } from "./painel";
import { mostrarAvisoConexao } from "./aviso-conexao";
import { criarConsulta, type ApiResult, type EstadoSessaoConteudo } from "./consulta";
import type { EstadoGaveta, LeadAmpliado } from "../shared/types";
import type { PedidoAcao, ResultadoAcao } from "../panel/acoes-lead";
import { requisicaoDaAcao, resultadoDaAcao } from "./acoes";

const adapter = new DefaultWhatsAppWebAdapter();

// Se o service worker estiver em cold start, a resposta pode demorar. Este
// limite garante que a promise nunca fique pendurada quando o canal é encerrado
// (ex.: aba fechada) e o callback de sendMessage não chega a ser invocado.
const REQUEST_TIMEOUT_MS = 15000;

const requisitar = (path: string, method: "POST" | "GET" | "PATCH", body?: unknown) =>
  new Promise<ApiResult>((resolve) => {
    let settled = false;
    let timer: number | undefined;
    const finish = (result: ApiResult) => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(result);
      }
    };
    try {
      chrome.runtime.sendMessage({ type: "API_REQUEST", payload: { path, method, body } }, (response) => {
        // Ler lastError suprime o log "Unchecked runtime.lastError" e trata
        // canais encerrados como resposta vazia em vez de lançar erro.
        if (chrome.runtime.lastError || !response || typeof response !== "object" || !("ok" in response)) {
          finish({ ok: false, status: 0, body: {} });
          return;
        }
        finish(response as ApiResult);
      });
      timer = window.setTimeout(() => finish({ ok: false, status: 0, body: {} }), REQUEST_TIMEOUT_MS);
    } catch {
      finish({ ok: false, status: 0, body: {} });
    }
  });

function openLeadInCrm(leadId: string) {
  try {
    chrome.runtime.sendMessage({ type: "OPEN_CRM_LEAD", payload: { leadId } }, () => {
      void chrome.runtime.lastError;
    });
  } catch {
    // Canal encerrado ou contexto inválido — ignora.
  }
}

async function quickReplies(lead: LeadAmpliado, goal: "ASK_MISSING_FIELD" | "CONTINUE_ATTENDANCE") {
  const result = await requisitar(`/api/extension/leads/${encodeURIComponent(lead.id)}/reply-suggestions`, "POST", { goal, expectedLeadVersion: lead.version, optionalContext: "" });
  if (!result.ok || !Array.isArray(result.body.suggestions)) return [];
  return result.body.suggestions.flatMap((suggestion) => typeof suggestion === "object" && suggestion && typeof (suggestion as Record<string, unknown>).text === "string" ? [(suggestion as Record<string, string>).text] : []);
}

let removerAviso: (() => void) | null = null;
let painelPronto: Promise<PainelWhatsApp | null> | null = null;
let painelInstancia: PainelWhatsApp | null = null;

function garantirPainel() {
  painelPronto ??= criarPainelWhatsApp({
    abrirNoCrm: (leadId) => openLeadInCrm(leadId),
    respostas: (lead, objetivo) => quickReplies(lead, objetivo),
    inserir: (texto) => { void adapter.insertComposerText(texto); },
    conectar: () => chrome.runtime.sendMessage({ type: "OPEN_CRM_CONNECT" }, () => void chrome.runtime.lastError),
    tentarNovamente: () => { consulta.invalidar(); safeSync(); },
    acao: (lead, pedido) => executarAcao(lead, pedido),
  }).then((criado) => {
    painelInstancia = criado;
    return criado;
  });
  return painelPronto;
}

// Com a gaveta aberta, ela mostra "Conectar ao CRM"; o aviso discreto só aparece com a gaveta fechada.
async function aoEstadoSessao(estado: EstadoSessaoConteudo) {
  const gavetaAberta = (await painelPronto)?.aberta() ?? false;
  if (estado === "sem-sessao" && !gavetaAberta) {
    removerAviso ??= mostrarAvisoConexao(() => chrome.runtime.sendMessage({ type: "OPEN_CRM_CONNECT" }, () => void chrome.runtime.lastError));
    return;
  }
  if (estado === "ativa" || estado === "sem-sessao") {
    removerAviso?.();
    removerAviso = null;
  }
}

// Versão nova do lead depois de uma ação. Vale só enquanto o CRM ainda estiver na versão de base:
// se a versão mudou por outro lado, a versão local é descartada e a tela usa a do servidor.
const versoes = new Map<string, { versao: number; base: number }>();

function ajustarVersao(estado: EstadoGaveta): EstadoGaveta {
  if (estado.tipo !== "lead") return estado;
  const local = versoes.get(estado.lead.id);
  if (!local || local.base !== estado.lead.version) return estado;
  return { tipo: "lead", lead: { ...estado.lead, version: local.versao } };
}

async function executarAcao(lead: LeadAmpliado, pedido: PedidoAcao): Promise<ResultadoAcao> {
  const requisicao = requisicaoDaAcao(lead, pedido);
  const resposta = await requisitar(requisicao.path, requisicao.metodo, requisicao.corpo);
  const resultado = resultadoDaAcao(resposta.status);
  if (!resultado.ok) {
    if (resultado.conflito) { consulta.invalidar(); safeSync(); }
    return resultado;
  }
  if (typeof resposta.body.version === "number") versoes.set(lead.id, { versao: resposta.body.version, base: lead.version });
  // Mudança de etapa altera o cartão inteiro: recarrega do CRM em vez de remendar a tela.
  if (pedido.tipo === "etapa") { consulta.invalidar(); safeSync(); }
  return resultado;
}

// Época de renderização: ao esconder por troca de sessão, renderizações que ainda estavam na fila perdem o efeito.
let epocaRender = 0;

const consulta = criarConsulta({
  pronto: () => adapter.isReady(),
  conversa: () => adapter.getActiveConversation(),
  requisitar,
  mostrar: (estado: EstadoGaveta, selo: SeloCabecalho | null) => {
    const epoca = epocaRender;
    void garantirPainel().then((controle) => { if (epoca === epocaRender) controle?.mostrar(ajustarVersao(estado), selo); });
  },
  ocultar: () => {
    const epoca = epocaRender;
    void garantirPainel().then((controle) => { if (epoca === epocaRender) controle?.ocultar(); });
  },
  neutro: () => {
    epocaRender++;
    // Só esconde o que já existe; a tela nova aparece quando a sessão nova for confirmada.
    painelInstancia?.ocultar();
  },
  aoEstadoSessao: (estado) => { void aoEstadoSessao(estado); },
  agora: () => Date.now(),
});

// Garante que falhas internas (ex.: adapter lendo React interno do WhatsApp)
// não virem rejeições não tratadas no console da página.
const safeSync = () => { void consulta.sincronizar().catch(() => undefined); };

// O worker avisa quando a sessão muda (troca de conta, revogação, expiração): descarta a tela e consulta de novo.
chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type === "SESSAO_MUDOU") {
    consulta.invalidar();
    safeSync();
  }
});

void safeSync();
adapter.observeConversationChange(safeSync);
window.setInterval(safeSync, 1500);
