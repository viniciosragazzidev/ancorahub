import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { mountPanel, type MountedPanel } from "./panel-mount";
import type { ResolveState } from "../shared/types";

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

let panel: MountedPanel | null = null;
let lastPhone = "";
let lastResolved: ResolveState | null = null;
let requestVersion = 0;

async function quickReplies(leadId: string, version: number, goal: "ASK_MISSING_FIELD" | "CONTINUE_ATTENDANCE") {
  const result = await request(`/api/extension/leads/${encodeURIComponent(leadId)}/reply-suggestions`, "POST", { goal, expectedLeadVersion: version, optionalContext: "" });
  if (!result.ok || !Array.isArray(result.body.suggestions)) return [];
  return result.body.suggestions.flatMap((suggestion) => typeof suggestion === "object" && suggestion && typeof (suggestion as Record<string, unknown>).text === "string" ? [(suggestion as Record<string, string>).text] : []);
}

function getPanel() {
  if (panel && !panel.isMounted()) panel = null;
  panel ??= mountPanel(
    (leadId) => openLeadInCrm(leadId),
    quickReplies,
    async (text) => { await adapter.insertComposerText(text); },
  );
  return panel;
}

function hidePanel() { getPanel()?.hide(); }

async function sync() {
  if (!adapter.isReady()) { lastPhone = ""; lastResolved = null; return hidePanel(); }
  const conversation = await adapter.getActiveConversation();
  if (!conversation?.phone) { lastPhone = ""; lastResolved = null; return hidePanel(); }
  if (conversation.phone === lastPhone) { if (lastResolved) getPanel()?.renderLead(lastResolved); return; }
  lastPhone = conversation.phone;
  const version = ++requestVersion;
  const result = await request("/api/extension/leads/resolve", "POST", { phone: conversation.phone });
  if (version !== requestVersion || conversation.phone !== lastPhone) return;
  const state = result.body as ResolveState;
  if (!result.ok || state.status !== "FOUND" || !state.lead) { lastResolved = null; return hidePanel(); }
  lastResolved = state;
  getPanel()?.renderLead(state);
}

// Garante que falhas internas (ex.: adapter lendo React interno do WhatsApp)
// não virem rejeições não tratadas no console da página.
const safeSync = () => { void sync().catch(() => undefined); };
void safeSync();
adapter.observeConversationChange(safeSync);
window.setInterval(safeSync, 1500);
