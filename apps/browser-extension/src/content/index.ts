import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { criarPainelWhatsApp, type PainelWhatsApp, type SeloCabecalho } from "./painel";
import { mostrarAvisoConexao } from "./aviso-conexao";
import { criarConsulta, type ApiResult, type EstadoSessaoConteudo } from "./consulta";
import type { EstadoGaveta, LeadAmpliado } from "../shared/types";

const adapter = new DefaultWhatsAppWebAdapter();

// Se o service worker estiver em cold start, a resposta pode demorar. Este
// limite garante que a promise nunca fique pendurada quando o canal é encerrado
// (ex.: aba fechada) e o callback de sendMessage não chega a ser invocado.
const REQUEST_TIMEOUT_MS = 15000;

const requisitar = (path: string, method: "POST" | "GET", body?: unknown) =>
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

function garantirPainel() {
  painelPronto ??= criarPainelWhatsApp({
    abrirNoCrm: (leadId) => openLeadInCrm(leadId),
    respostas: (lead, objetivo) => quickReplies(lead, objetivo),
    inserir: (texto) => { void adapter.insertComposerText(texto); },
    conectar: () => chrome.runtime.sendMessage({ type: "OPEN_CRM_CONNECT" }, () => void chrome.runtime.lastError),
    tentarNovamente: () => { consulta.invalidar(); safeSync(); },
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

const consulta = criarConsulta({
  pronto: () => adapter.isReady(),
  conversa: () => adapter.getActiveConversation(),
  requisitar,
  mostrar: (estado: EstadoGaveta, selo: SeloCabecalho | null) => { void garantirPainel().then((controle) => controle?.mostrar(estado, selo)); },
  ocultar: () => { void garantirPainel().then((controle) => controle?.ocultar()); },
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
