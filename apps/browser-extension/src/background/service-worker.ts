const API_BASE = "https://corretop.vercel.app";

chrome.runtime.onMessage.addListener((message: { type?: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
  if (message.type === "API_REQUEST") {
    void (async () => {
      const { token } = await chrome.storage.session.get("token");
      const response = await fetch(`${API_BASE}${String(message.payload?.path ?? "")}`, { method: String(message.payload?.method ?? "GET"), headers: { authorization: token ? `Bearer ${token}` : "", "content-type": "application/json" }, body: message.payload?.body ? JSON.stringify(message.payload.body) : undefined });
      sendResponse({ ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) });
    })().catch(() => sendResponse({ ok: false, status: 0, body: { error: "OFFLINE" } }));
    return true;
  }
  if (message.type === "OPEN_CRM_LEAD") {
    const leadId = String(message.payload?.leadId ?? "");
    if (!/^[a-zA-Z0-9-]{8,128}$/.test(leadId)) return false;
    chrome.tabs.create({ url: `${API_BASE}/leads/${encodeURIComponent(leadId)}` });
    sendResponse({ ok: true });
    return false;
  }
  return false;
});
