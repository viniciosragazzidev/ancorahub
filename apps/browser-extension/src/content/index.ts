import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { mountPanel, type MountedPanel } from "./panel-mount";
import type { ResolveState } from "../shared/types";

type ApiResult = { ok: boolean; body: Record<string, unknown> };

const adapter = new DefaultWhatsAppWebAdapter();
const request = (path: string, method: "POST" | "GET", body?: unknown) => new Promise<ApiResult>((resolve) => chrome.runtime.sendMessage({ type: "API_REQUEST", payload: { path, method, body } }, resolve));
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
    (leadId) => chrome.runtime.sendMessage({ type: "OPEN_CRM_LEAD", payload: { leadId } }),
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

void sync();
adapter.observeConversationChange(() => void sync());
window.setInterval(() => void sync(), 1500);
