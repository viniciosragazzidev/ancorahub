import "server-only";

const openWaBase = () => { const value = (process.env.OPENWA_BASE_URL ?? "http://localhost:2785").replace(/\/$/, ""); return value.endsWith("/api") ? value : `${value}/api`; };
const openWaHeaders = () => ({ "Content-Type": "application/json", "X-API-Key": process.env.OPENWA_API_KEY ?? "" });

export function normalizeOpenWaStatus(value: unknown) {
  const status = String(value ?? "").trim().toLowerCase();
  if (["ready", "connected", "authenticated", "open", "online"].includes(status)) return "ready";
  if (["qr", "qr_ready", "waiting_qr", "waiting-for-qr", "scan_qr"].includes(status)) return "qr_ready";
  if (["created", "starting", "initializing", "connecting", "loading"].includes(status)) return "initializing";
  if (["disconnected", "closed", "logged_out", "logout", "offline", "stopped"].includes(status)) return "disconnected";
  return status || "disconnected";
}

export async function createOpenWaSession(name: string) {
  const response = await fetch(`${openWaBase()}/sessions`, { method: "POST", headers: openWaHeaders(), body: JSON.stringify({ name }), cache: "no-store" });
  if (!response.ok) throw new Error(`OpenWA create session failed: ${response.status}`);
  const session = await response.json() as { id: string; name?: string; status?: string };
  const start = await fetch(`${openWaBase()}/sessions/${session.id}/start`, { method: "POST", headers: openWaHeaders(), cache: "no-store" });
  if (!start.ok && start.status !== 400) throw new Error(`OpenWA start session failed: ${start.status}`);
  return { ...session, ...(await start.json().catch(() => ({})) as { status?: string; qrCode?: string }) };
}

export async function getOpenWaQr(sessionId: string) {
  const response = await fetch(`${openWaBase()}/sessions/${sessionId}/qr`, { headers: openWaHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(`OpenWA QR failed: ${response.status}`);
  return response.json() as Promise<{ qrCode?: string; status?: string }>;
}

export async function registerOpenWaWebhook(sessionId: string, webhookUrl: string, secret: string) {
  const response = await fetch(`${openWaBase()}/sessions/${sessionId}/webhooks`, { method: "POST", headers: openWaHeaders(), body: JSON.stringify({ url: webhookUrl, events: ["session.status", "message.received", "message.status"], secret }), cache: "no-store" });
  if (!response.ok) throw new Error(`OpenWA webhook registration failed: ${response.status}`);
}

export async function sendOpenWaText(sessionId: string, phone: string, text: string) {
  const chatId = phone.includes("@") ? phone : `${phone.replace(/\D/g, "")}@c.us`;
  const response = await fetch(`${openWaBase()}/sessions/${sessionId}/messages/send-text`, { method: "POST", headers: openWaHeaders(), body: JSON.stringify({ chatId, text }), cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let message = detail;
    try { const parsed = JSON.parse(detail) as { message?: string; error?: string }; message = parsed.message ?? parsed.error ?? detail; } catch { /* OpenWA may return plain text. */ }
    throw new Error(`OpenWA não enviou a mensagem (${response.status})${message ? `: ${message}` : "."}`);
  }
  return response.json() as Promise<{ messageId?: string }>;
}

export async function getOpenWaSessionStatus(sessionId: string) {
  const response = await fetch(`${openWaBase()}/sessions/${sessionId}`, { headers: openWaHeaders(), cache: "no-store" });
  if (!response.ok) throw new Error(`OpenWA não respondeu ao status (${response.status}).`);
  return response.json() as Promise<{ status?: string; phone?: string }>;
}

export async function getOpenWaContact(sessionId: string, contactId: string) {
  const response = await fetch(`${openWaBase()}/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}`, { headers: openWaHeaders(), cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<{ id?: string; number?: string }>;
}
