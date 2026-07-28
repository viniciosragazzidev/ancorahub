import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { mountPanel, type MountedPanel } from "./panel-mount";
import type { ResolveState } from "../shared/types";

const adapter = new DefaultWhatsAppWebAdapter();
const api = (path: string, body: unknown) => new Promise<{ ok: boolean; body: Record<string, unknown> }>((resolve) => chrome.runtime.sendMessage({ type: "API_REQUEST", payload: { path, method: "POST", body } }, resolve));
let panel: MountedPanel | null = null;
let lastPhone = "";
let lastResolved: ResolveState | null = null;
let requestVersion = 0;

function getPanel() {
  panel ??= mountPanel((leadId) => window.open(`https://corretop.vercel.app/leads/${encodeURIComponent(leadId)}`, "_blank", "noopener,noreferrer"));
  return panel;
}

function hidePanel() {
  getPanel()?.hide();
}

async function sync() {
  if (!adapter.isReady()) {
    lastPhone = "";
    lastResolved = null;
    return hidePanel();
  }
  const conversation = await adapter.getActiveConversation();
  if (!conversation?.phone) {
    lastPhone = "";
    lastResolved = null;
    return hidePanel();
  }
  if (conversation.phone === lastPhone) {
    if (lastResolved) getPanel()?.renderLead(lastResolved);
    return;
  }
  lastPhone = conversation.phone;
  const version = ++requestVersion;
  const result = await api("/api/extension/leads/resolve", { phone: conversation.phone });
  if (version !== requestVersion || conversation.phone !== lastPhone) return;
  const state = result.body as ResolveState;
  if (!result.ok || state.status !== "FOUND" || !state.lead) {
    lastResolved = null;
    return hidePanel();
  }
  lastResolved = state;
  getPanel()?.renderLead(state);
}

void sync();
adapter.observeConversationChange(() => void sync());
window.setInterval(() => void sync(), 1500);
