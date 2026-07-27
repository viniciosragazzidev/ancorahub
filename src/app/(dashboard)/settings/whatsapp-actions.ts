"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { normalizeOpenWaStatus, registerOpenWaWebhook } from "@/lib/integrations/openwa";

const baseUrl = () => { const value = (process.env.OPENWA_BASE_URL ?? "http://localhost:2785").replace(/\/$/, ""); return value.endsWith("/api") ? value : `${value}/api`; };
const headers = () => ({ "Content-Type": "application/json", "X-API-Key": process.env.OPENWA_API_KEY ?? "" });

async function getOwnConnection() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [connection] = await db.select().from(schema.whatsappConnections).where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId))).limit(1);
  return { context, db, connection };
}

export async function getWhatsAppConnection() {
  const { context, connection } = await getOwnConnection();
  return connection ? { tenantId: connection.tenantId, userId: connection.userId, sessionId: connection.sessionId, sessionName: connection.sessionName, status: connection.status, qrCode: connection.qrCode, chatInternoAtivo: connection.chatInternoAtivo, connectedAt: connection.connectedAt } : { tenantId: context.tenantId, userId: context.userId, sessionId: null, sessionName: null, status: "disconnected", qrCode: null, chatInternoAtivo: true, connectedAt: null };
}

export async function startWhatsAppConnection() {
  const { context, db } = await getOwnConnection();
  let [connection] = await db.select().from(schema.whatsappConnections).where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId))).limit(1);
  try {
    if (!connection?.sessionId) {
      const response = await fetch(`${baseUrl()}/sessions`, { method: "POST", headers: headers(), body: JSON.stringify({ name: `corretop-${context.userId.slice(0, 8)}` }), cache: "no-store" });
      if (!response.ok) throw new Error("OpenWA não conseguiu criar a sessão.");
      const session = await response.json() as { id?: string; name?: string; status?: string };
      if (!session.id) throw new Error("OpenWA não retornou o identificador da sessão.");
      const values = { id: randomUUID(), tenantId: context.tenantId, userId: context.userId, sessionId: session.id, sessionName: session.name ?? null, status: normalizeOpenWaStatus(session.status ?? "created"), webhookSecret: randomUUID(), updatedAt: new Date() };
      if (connection) await db.update(schema.whatsappConnections).set(values).where(eq(schema.whatsappConnections.id, connection.id));
      else await db.insert(schema.whatsappConnections).values(values);
      [connection] = await db.select().from(schema.whatsappConnections).where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId))).limit(1);
    }
    if (!connection?.sessionId) throw new Error("Sessão não configurada.");
    const publicAppUrl = (process.env.OPENWA_WEBHOOK_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://corretop.vercel.app").replace(/\/$/, "");
    await registerOpenWaWebhook(connection.sessionId, `${publicAppUrl}/api/webhooks/openwa/${context.tenantId}`, connection.webhookSecret ?? process.env.OPENWA_WEBHOOK_SECRET ?? "").catch(() => undefined);
    const response = await fetch(`${baseUrl()}/sessions/${connection.sessionId}/start`, { method: "POST", headers: headers(), cache: "no-store" });
    if (!response.ok && response.status !== 400) throw new Error("OpenWA não conseguiu iniciar a sessão.");
    await db.update(schema.whatsappConnections).set({ status: "initializing", qrCode: null, chatInternoAtivo: true, updatedAt: new Date() }).where(eq(schema.whatsappConnections.id, connection.id));
    return { success: true };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Não foi possível iniciar o WhatsApp." }; }
}

export async function refreshWhatsAppQr() {
  const { db, connection } = await getOwnConnection();
  if (!connection?.sessionId) return { success: false, error: "Inicie uma sessão primeiro." };
  try {
    const response = await fetch(`${baseUrl()}/sessions/${connection.sessionId}/qr`, { headers: headers(), cache: "no-store" });
    const data = await response.json() as { qrCode?: string; status?: string };
    if (!response.ok) throw new Error("QR ainda não disponível. Aguarde alguns segundos.");
    const status = normalizeOpenWaStatus(data.status ?? connection.status);
    await db.update(schema.whatsappConnections).set({ qrCode: status === "ready" ? null : data.qrCode ?? null, status, connectedAt: status === "ready" ? connection.connectedAt ?? new Date() : connection.connectedAt, chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo, updatedAt: new Date() }).where(eq(schema.whatsappConnections.id, connection.id));
    return { success: true, qrCode: status === "ready" ? null : data.qrCode ?? null, status };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar o QR Code." }; }
}

export async function toggleWhatsAppChatAction(): Promise<{ success: boolean; active?: boolean; error?: string }> {
  const { context, db, connection } = await getOwnConnection();
  const active = !(connection?.chatInternoAtivo ?? true);
  if (!connection) await db.insert(schema.whatsappConnections).values({ id: randomUUID(), tenantId: context.tenantId, userId: context.userId, chatInternoAtivo: active, updatedAt: new Date() });
  else await db.update(schema.whatsappConnections).set({ chatInternoAtivo: active, updatedAt: new Date() }).where(eq(schema.whatsappConnections.id, connection.id));
  return { success: true, active };
}

export async function getWhatsAppSessionStatus() {
  const { db, connection } = await getOwnConnection();
  if (!connection?.sessionId) return { success: false, error: "Sessão não configurada." };
  try {
    const response = await fetch(`${baseUrl()}/sessions/${connection.sessionId}`, { headers: headers(), cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível consultar o status do WhatsApp.");
    const data = await response.json() as { status?: string; phone?: string; session?: { status?: string } };
    const status = normalizeOpenWaStatus(data.status ?? data.session?.status ?? connection.status);
    await db.update(schema.whatsappConnections).set({ status, qrCode: status === "ready" ? null : connection.qrCode, connectedAt: status === "ready" ? connection.connectedAt ?? new Date() : connection.connectedAt, chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo, updatedAt: new Date() }).where(eq(schema.whatsappConnections.id, connection.id));
    return { success: true, status, phone: data.phone ?? null };
  } catch (error) { return { success: false, error: error instanceof Error ? error.message : "Não foi possível consultar o status." }; }
}

export async function resetWhatsAppSessionAction() {
  const { db, connection } = await getOwnConnection();
  try { if (connection?.sessionId) await fetch(`${baseUrl()}/sessions/${connection.sessionId}`, { method: "DELETE", headers: headers(), cache: "no-store" }); }
  finally { if (connection) await db.update(schema.whatsappConnections).set({ sessionId: null, sessionName: null, status: "disconnected", qrCode: null, connectedAt: null, updatedAt: new Date() }).where(eq(schema.whatsappConnections.id, connection.id)); }
  return { success: true };
}
