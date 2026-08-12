const API_BASE = "https://crm.ancorasaude.cloud";

/**
 * Encapsula o `sendResponse` do listener. Quando o remetente encerra o canal
 * (ex.: aba do WhatsApp Web fechada durante o fetch, extensão recarregada), a
 * resposta não pode mais ser entregue. Sem essa proteção, o Chrome registra
 * "A listener indicated an asynchronous response by returning true, but the
 * message channel closed before a response was received".
 */
function createResponder(sendResponse: (value: unknown) => void) {
  let sent = false;
  return (value: unknown) => {
    if (sent) return;
    sent = true;
    try {
      sendResponse(value);
    } catch {
      // Canal encerrado pelo remetente — ignora silenciosamente.
    }
  };
}

chrome.runtime.onMessage.addListener((message: { type?: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
  const respond = createResponder(sendResponse);
  if (message.type === "API_REQUEST") {
    void (async () => {
      try {
        const { token } = await chrome.storage.session.get("token");
        const response = await fetch(`${API_BASE}${String(message.payload?.path ?? "")}`, { method: String(message.payload?.method ?? "GET"), headers: { authorization: token ? `Bearer ${token}` : "", "content-type": "application/json" }, body: message.payload?.body ? JSON.stringify(message.payload.body) : undefined });
        respond({ ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) });
      } catch {
        respond({ ok: false, status: 0, body: { error: "OFFLINE" } });
      }
    })();
    return true;
  }
  if (message.type === "OPEN_CRM_LEAD") {
    const leadId = String(message.payload?.leadId ?? "");
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(leadId)) return false;
    try {
      chrome.tabs.create({ url: `${API_BASE}/leads/${encodeURIComponent(leadId)}` });
    } catch {
      respond({ ok: false });
      return false;
    }
    respond({ ok: true });
    return false;
  }
  return false;
});
