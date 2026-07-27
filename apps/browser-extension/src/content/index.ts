import { DefaultWhatsAppWebAdapter } from "./whatsapp-adapter";
import { mountPanel } from "./panel-mount";

const adapter = new DefaultWhatsAppWebAdapter();
const api = (path: string, body: unknown) => new Promise<{ ok: boolean; body: Record<string, unknown> }>((resolve) => chrome.runtime.sendMessage({ type: "API_REQUEST", payload: { path, method: "POST", body } }, resolve));
const panel = mountPanel(() => undefined, (text) => void adapter.insertComposerText(text));
let lastPhone = "";
async function sync() {
  if (!adapter.isReady()) return panel.render({ status: "INITIALIZING" });
  const conversation = await adapter.getActiveConversation();
  if (!conversation) return panel.render({ status: "NO_CONVERSATION" });
  if (!conversation.phone) return panel.render({ status: "UNIDENTIFIED" });
  if (conversation.phone === lastPhone) return;
  lastPhone = conversation.phone; panel.render({ status: "LOADING" });
  const result = await api("/api/extension/leads/resolve", { phone: conversation.phone });
  if (!result.ok) return panel.render({ status: result.body.error === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "OFFLINE" });
  panel.render(result.body as never);
}
void sync(); adapter.observeConversationChange(() => void sync());
