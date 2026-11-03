import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { criarPainelWhatsApp, type PainelWhatsApp, type SeloCabecalho } from "./painel";
import { mostrarAvisoConexao } from "./aviso-conexao";
import { estadoDoResolve } from "../shared/lead-ampliado";
import type { EstadoGaveta, LeadAmpliado } from "../shared/types";

// A checagem de sessão é cacheada: não chama a API a cada conversa (o sync roda a cada 1,5 s).
const INTERVALO_SESSAO_MS = 5 * 60_000;
let sessao: { estado: "ativa" | "sem-sessao" | "desconhecida"; em: number } | null = null;
let removerAviso: (() => void) | null = null;

async function estadoSessao() {
  if (sessao && Date.now() - sessao.em < INTERVALO_SESSAO_MS) return sessao.estado;
  const result = await request("/api/extension/session", "GET");
  // 401 = sem sessão válida. Erro de rede (status 0) não avisa ninguém: o estado fica desconhecido.
  const estado = result.ok ? "ativa" : result.status === 401 ? "sem-sessao" : "desconhecida";
  sessao = { estado, em: Date.now() };
  return estado;
}

async function atualizarAvisoConexao() {
  const estado = await estadoSessao();
  // Com a gaveta aberta, ela mesma mostra "Conectar ao CRM"; o aviso discreto só aparece com a gaveta fechada.
  const gavetaAberta = (await painelPronto)?.aberta() ?? false;
  if (estado === "sem-sessao" && !gavetaAberta) {
    removerAviso ??= mostrarAvisoConexao(() => chrome.runtime.sendMessage({ type: "OPEN_CRM_CONNECT" }, () => void chrome.runtime.lastError));
    return;
  }
  if (estado === "sem-sessao") {
    removerAviso?.();
    removerAviso = null;
    return;
  }
  if (estado === "ativa") {
    removerAviso?.();
    removerAviso = null;
  }
}

type ApiResult = { ok: boolean; status: number; body: Record<string, unknown> };

const adapter = new DefaultWhatsAppWebAdapter();

// Se o service worker estiver em cold start, a resposta pode demorar. Este
// limite garante que a promise nunca fique pendurada quando o canal é encerrado
// (ex.: aba fechada) e o callback de sendMessage não chega a ser invocado.
const REQUEST_TIMEOUT_MS = 15000;

const request = (path: string, method: "POST" | "GET", body?: unknown) =>
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
        finish(response);
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
  const result = await request(`/api/extension/leads/${encodeURIComponent(lead.id)}/reply-suggestions`, "POST", { goal, expectedLeadVersion: lead.version, optionalContext: "" });
  if (!result.ok || !Array.isArray(result.body.suggestions)) return [];
  return result.body.suggestions.flatMap((suggestion) => typeof suggestion === "object" && suggestion && typeof (suggestion as Record<string, unknown>).text === "string" ? [(suggestion as Record<string, string>).text] : []);
}

let painelPronto: Promise<PainelWhatsApp | null> | null = null;
let lastPhone = "";
let lastEstado: { estado: EstadoGaveta; selo: SeloCabecalho | null } | null = null;
let requestVersion = 0;

function garantirPainel() {
  painelPronto ??= criarPainelWhatsApp({
    abrirNoCrm: (leadId) => openLeadInCrm(leadId),
    respostas: (lead, objetivo) => quickReplies(lead, objetivo),
    inserir: (texto) => { void adapter.insertComposerText(texto); },
    conectar: () => chrome.runtime.sendMessage({ type: "OPEN_CRM_CONNECT" }, () => void chrome.runtime.lastError),
    tentarNovamente: () => { lastPhone = ""; safeSync(); },
  });
  return painelPronto;
}

function mostrar(estado: EstadoGaveta, selo: SeloCabecalho | null) {
  lastEstado = { estado, selo };
  void garantirPainel().then((controle) => controle?.mostrar(estado, selo));
}

function ocultar() {
  lastEstado = null;
  void garantirPainel().then((controle) => controle?.ocultar());
}

async function sync() {
  if (!adapter.isReady()) { lastPhone = ""; lastEstado = null; return ocultar(); }
  void atualizarAvisoConexao();
  const conversation = await adapter.getActiveConversation();
  if (!conversation?.phone) { lastPhone = ""; lastEstado = null; return ocultar(); }
  if (conversation.phone === lastPhone) { if (lastEstado) mostrar(lastEstado.estado, lastEstado.selo); return; }
  lastPhone = conversation.phone;
  const version = ++requestVersion;
  mostrar({ tipo: "carregando" }, null);
  const result = await request("/api/extension/leads/resolve", "POST", { phone: conversation.phone });
  if (version !== requestVersion || conversation.phone !== lastPhone) return;
  const estado = !result.ok && result.status === 401
    ? ({ tipo: "sem-conexao" } as const)
    : estadoDoResolve(result.ok ? (result.body as { status: string; lead?: Record<string, unknown> }) : { status: "OFFLINE" });
  if (!estado) { lastEstado = null; return ocultar(); }
  const selo = estado.tipo === "lead" ? { etapa: estado.lead.etapa, temperatura: estado.lead.temperatura } : null;
  mostrar(estado, selo);
}

// Garante que falhas internas (ex.: adapter lendo React interno do WhatsApp)
// não virem rejeições não tratadas no console da página.
const safeSync = () => { void sync().catch(() => undefined); };
void safeSync();
adapter.observeConversationChange(safeSync);
window.setInterval(safeSync, 1500);
