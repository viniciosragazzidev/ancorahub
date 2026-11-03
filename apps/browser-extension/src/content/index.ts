import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { criarPainelWhatsApp, type PainelWhatsApp, type SeloCabecalho } from "./painel";
import { mostrarAvisoConexao } from "./aviso-conexao";
import { criarConsulta, type ApiResult, type EstadoSessaoConteudo } from "./consulta";
import type { AvisoInboxExtensao, EstadoGaveta, LeadAmpliado, OfertaExtensao } from "../shared/types";
import type { AcoesGaveta } from "../panel/gaveta";
import type { PedidoAcao, ResultadoAcao } from "../panel/acoes-lead";
import type { ResultadoAceiteOferta, ResultadoListaOfertas, ResultadoRecusaOferta } from "../panel/ofertas";
import type { LeadAguardandoInicio, ResultadoInicioLead, ResultadoListaAguardando } from "../panel/aguardando-inicio";
import type { DadosHistorico, MensagemQualificacao } from "../panel/historico-qualificacao";
import { requisicaoDaAcao, resultadoDaAcao } from "./acoes";
import { INBOX_POLL_MS, INBOX_PORT_NAME } from "../background/inbox-state";

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

function mensagemWorker<T>(type: string, payload?: Record<string, unknown>): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type, payload }, (response) => resolve(chrome.runtime.lastError ? null : response as T));
    } catch { resolve(null); }
  });
}

function ofertaValida(value: unknown): OfertaExtensao | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.expiresAt !== "string" || !Number.isFinite(Date.parse(item.expiresAt))
    || typeof item.primeiroNome !== "string" || typeof item.phoneMasked !== "string"
    || typeof item.foraDoPlantao !== "boolean" || (item.plantao !== null && typeof item.plantao !== "string")) return null;
  const temperatura = ["quente", "morno", "frio", "sem-dados"].includes(String(item.temperatura)) ? item.temperatura as OfertaExtensao["temperatura"] : "sem-dados";
  return { id: item.id, expiresAt: item.expiresAt, plantao: item.plantao as string | null, temperatura,
    primeiroNome: item.primeiroNome, phoneMasked: item.phoneMasked, foraDoPlantao: item.foraDoPlantao };
}

function falhaApi(result: ApiResult) {
  return {
    ok: false as const,
    error: typeof result.body.error === "string" ? result.body.error : String(result.status || "OFFLINE"),
    message: typeof result.body.message === "string" ? result.body.message : "Não foi possível concluir agora. Tente de novo em instantes.",
    retryAfter: result.retryAfter,
  };
}

async function carregarOfertas(): Promise<ResultadoListaOfertas> {
  const result = await requisitar("/api/extension/offers", "GET");
  const offers = result.body.offers;
  if (!result.ok || !Array.isArray(offers)) return { ok: false, retryAfter: result.retryAfter };
  return { ok: true, ofertas: offers.map(ofertaValida).filter((item): item is OfertaExtensao => item !== null) };
}

async function aceitarOferta(offerId: string): Promise<ResultadoAceiteOferta> {
  const result = await requisitar(`/api/extension/offers/${encodeURIComponent(offerId)}/accept`, "POST");
  if (!result.ok || result.body.success !== true || typeof result.body.phone !== "string"
    || typeof result.body.greeting !== "string" || typeof result.body.whatsappUrl !== "string") return falhaApi(result);
  return { ok: true, phone: result.body.phone, greeting: result.body.greeting, whatsappUrl: result.body.whatsappUrl };
}

async function recusarOferta(offerId: string): Promise<ResultadoRecusaOferta> {
  const result = await requisitar(`/api/extension/offers/${encodeURIComponent(offerId)}/decline`, "POST");
  if (!result.ok || result.body.success !== true) return falhaApi(result);
  return { ok: true, alreadyDeclined: result.body.alreadyDeclined === true, contaComoPulo: result.body.contaComoPulo === true,
    message: typeof result.body.message === "string" ? result.body.message : "Oferta recusada." };
}

function leadAguardandoValido(value: unknown): LeadAguardandoInicio | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.primeiroNome !== "string" || typeof item.phoneMasked !== "string"
    || (item.atribuidoEm !== null && typeof item.atribuidoEm !== "string")) return null;
  const temperatura = ["quente", "morno", "frio", "sem-dados"].includes(String(item.temperatura)) ? item.temperatura as LeadAguardandoInicio["temperatura"] : "sem-dados";
  return { id: item.id, primeiroNome: item.primeiroNome, phoneMasked: item.phoneMasked, temperatura, atribuidoEm: item.atribuidoEm as string | null };
}

async function carregarAguardandoInicio(): Promise<ResultadoListaAguardando> {
  const result = await requisitar("/api/extension/leads/aguardando-inicio", "GET");
  const leads = result.body.leads;
  if (!result.ok || !Array.isArray(leads)) return { ok: false, retryAfter: result.retryAfter };
  return { ok: true, leads: leads.map(leadAguardandoValido).filter((item): item is LeadAguardandoInicio => item !== null) };
}

async function iniciarLeadAguardando(leadId: string): Promise<ResultadoInicioLead> {
  const result = await requisitar(`/api/extension/leads/${encodeURIComponent(leadId)}/start`, "POST");
  if (!result.ok || result.body.success !== true || typeof result.body.phone !== "string"
    || typeof result.body.greeting !== "string" || typeof result.body.whatsappUrl !== "string") return { ok: false, message: falhaApi(result).message };
  return { ok: true, phone: result.body.phone, greeting: result.body.greeting, whatsappUrl: result.body.whatsappUrl };
}

function abrirReservaWhatsApp(url: string) {
  chrome.runtime.sendMessage({ type: "OPEN_WHATSAPP_FALLBACK", payload: { url } }, () => void chrome.runtime.lastError);
}

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
    carregar: carregarOfertas,
    aceitar: aceitarOferta,
    recusar: recusarOferta,
    carregarAguardando: carregarAguardandoInicio,
    iniciarLead: iniciarLeadAguardando,
    abrirConversa: async (input) => {
      const result = await adapter.openNewConversation(input.phone, input.greeting);
      return result.success ? { ok: true as const } : { ok: false as const, reason: result.reason ?? "OPEN_FAILED" };
    },
    abrirReserva: abrirReservaWhatsApp,
    lerSom: async () => (await mensagemWorker<{ enabled?: boolean }>("LER_SOM_ALERTAS"))?.enabled === true,
    definirSom: (enabled) => { void mensagemWorker("DEFINIR_SOM_ALERTAS", { enabled }); },
    abrirNotificacoes: () => { void mensagemWorker("OPEN_CRM_NOTIFICATIONS"); },
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

// Histórico da qualificação na conversa do lead. Só lê (GET), nunca grava nem envia. Cache por lead na sessão atual.
let leadDaConversa: string | null = null;
let historicoDoLead: { leadId: string; dados: DadosHistorico | null } | null = null;

function historicoValido(body: Record<string, unknown>): DadosHistorico | null {
  if (typeof body.total !== "number" || !Array.isArray(body.mensagens)) return null;
  const mensagens = body.mensagens.flatMap((item): MensagemQualificacao[] => {
    if (!item || typeof item !== "object") return [];
    const m = item as Record<string, unknown>;
    if ((m.de !== "cliente" && m.de !== "qualificacao") || typeof m.texto !== "string" || typeof m.horario !== "string") return [];
    return [{ de: m.de, texto: m.texto, horario: m.horario }];
  });
  return { total: body.total, mensagens };
}

async function mostrarHistoricoDoLead(leadId: string, controle: PainelWhatsApp, epoca: number) {
  let cache = historicoDoLead;
  if (cache?.leadId !== leadId) {
    const result = await requisitar(`/api/extension/leads/${encodeURIComponent(leadId)}/qualification-thread`, "GET");
    cache = { leadId, dados: result.ok ? historicoValido(result.body) : null };
    historicoDoLead = cache;
  }
  // Se a conversa mudou enquanto lia, não mostra o histórico de outro lead.
  if (epoca !== epocaRender || leadDaConversa !== leadId) return;
  const dados = cache.dados;
  controle.mostrarHistorico(dados && dados.total > 0 ? dados : null);
}

const consulta = criarConsulta({
  pronto: () => adapter.isReady(),
  conversa: () => adapter.getActiveConversation(),
  requisitar,
  mostrar: (estado: EstadoGaveta, selo: SeloCabecalho | null) => {
    const epoca = epocaRender;
    leadDaConversa = estado.tipo === "lead" ? estado.lead.id : null;
    void garantirPainel().then((controle) => {
      if (epoca !== epocaRender) return;
      controle?.mostrar(ajustarVersao(estado), selo);
      if (estado.tipo === "lead" && controle) void mostrarHistoricoDoLead(estado.lead.id, controle, epoca);
      else controle?.mostrarHistorico(null);
    });
  },
  ocultar: () => {
    const epoca = epocaRender;
    void garantirPainel().then((controle) => { if (epoca === epocaRender) controle?.ocultar(); });
  },
  neutro: () => {
    epocaRender++;
    historicoDoLead = null;
    leadDaConversa = null;
    // Só esconde o que já existe; a tela nova aparece quando a sessão nova for confirmada.
    painelInstancia?.limpar();
  },
  aoEstadoSessao: (estado) => { void aoEstadoSessao(estado); },
  agora: () => Date.now(),
});

// Garante que falhas internas (ex.: adapter lendo React interno do WhatsApp)
// não virem rejeições não tratadas no console da página.
const safeSync = () => { void consulta.sincronizar().catch(() => undefined); };

function avisoValido(value: unknown): AvisoInboxExtensao | null {
  if (!value || typeof value !== "object") return null;
  const aviso = value as Record<string, unknown>;
  if (typeof aviso.id !== "string" || !["offer", "last-minute", "update"].includes(String(aviso.tipo))) return null;
  return { id: aviso.id, tipo: aviso.tipo as AvisoInboxExtensao["tipo"], ...(typeof aviso.offerId === "string" ? { offerId: aviso.offerId } : {}) };
}

async function executarAcaoWorker(message: { type?: string; payload?: Record<string, unknown> }) {
  if (message.type === "OPEN_EXTENSION_OFFERS") {
    const controle = await garantirPainel();
    controle?.abrirOfertas(typeof message.payload?.offerId === "string" ? message.payload.offerId : undefined);
    return Boolean(controle);
  }
  if (message.type === "SHOW_INBOX_NOTICE") {
    const aviso = avisoValido(message.payload?.aviso);
    if (!aviso) return false;
    const controle = await garantirPainel();
    controle?.mostrarAviso(aviso);
    return Boolean(controle);
  }
  return false;
}

// O worker invalida o painel ao trocar a sessão e envia alertas já minimizados, sem texto do cliente.
chrome.runtime.onMessage.addListener((message: { type?: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
  if (message?.type === "SESSAO_MUDOU") {
    consulta.invalidar();
    safeSync();
    sendResponse({ ok: true });
    return false;
  }
  if (message?.type === "OPEN_EXTENSION_OFFERS" || message?.type === "SHOW_INBOX_NOTICE") {
    void executarAcaoWorker(message).then((ok) => sendResponse({ ok })).catch(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});

// A porta indica que há ao menos uma aba do WhatsApp ativa; o worker usa esse sinal para o ciclo de 20 s.
let inboxPort: ChromePort | null = null;
let reconectarInbox: number | undefined;
let pollInbox: number | undefined;
function conectarInbox() {
  if (inboxPort) return;
  try {
    inboxPort = chrome.runtime.connect({ name: INBOX_PORT_NAME });
    pollInbox = window.setInterval(() => {
      try { inboxPort?.postMessage({ type: "POLL_INBOX" }); } catch { /* onDisconnect agenda reconexão */ }
    }, INBOX_POLL_MS);
    inboxPort.onDisconnect.addListener(() => {
      inboxPort = null;
      window.clearInterval(pollInbox);
      pollInbox = undefined;
      window.clearTimeout(reconectarInbox);
      reconectarInbox = window.setTimeout(conectarInbox, 2000);
    });
  } catch {
    reconectarInbox = window.setTimeout(conectarInbox, 5000);
  }
}
conectarInbox();
void mensagemWorker<{ type?: string; payload?: Record<string, unknown> }>("WHATSAPP_READY")
  .then((pending) => pending && executarAcaoWorker(pending))
  .catch(() => undefined);

void safeSync();
adapter.observeConversationChange(safeSync);
window.setInterval(safeSync, 1500);
