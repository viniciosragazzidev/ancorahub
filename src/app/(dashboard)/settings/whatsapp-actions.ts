"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// ── WAHA via Fastify ──────────────────────────────────────────────────

function vpsBaseUrl() {
  const value = process.env.VPS_API_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function vpsHeaders() {
  return {
    "Content-Type": "application/json",
    "X-CorreTop-Internal-Token": process.env.WHATSAPP_API_INTERNAL_TOKEN ?? "",
    "Authorization": `Bearer ${process.env.VPS_INTERNAL_API_TOKEN ?? ""}`,
  };
}

function generateWahaSessionName(tenantId: string, userId: string): string {
  return `waha_${createHash("sha256").update(`${tenantId}:${userId}`).digest("hex").slice(0, 16)}`;
}

type WahaConnectionResponse = {
  ok: boolean;
  sessionName?: string;
  status?: string;
  reused?: boolean;
  qr?: string | null;
  phoneNumber?: string | null;
  error?: string;
  timestamp?: string;
};

async function vpsRequest<T extends WahaConnectionResponse>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const base = vpsBaseUrl();
  if (!base) throw new Error("VPS_API_URL não configurada.");

  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: vpsHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !data?.ok) {
    const message = data && "error" in data ? String(data.error) : `WAHA retornou status ${response.status}`;
    throw new Error(message);
  }
  return data;
}

// ── Connection helpers ────────────────────────────────────────────────

async function getOwnConnection() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [connection] = await db
    .select()
    .from(schema.whatsappConnections)
    .where(
      and(
        eq(schema.whatsappConnections.tenantId, context.tenantId),
        eq(schema.whatsappConnections.userId, context.userId),
      ),
    )
    .limit(1);
  return { context, db, connection };
}

function normalizeWahaStatus(raw: string): string {
  const s = raw.toUpperCase();
  if (s === "WORKING") return "ready";
  if (s === "STOPPED") return "disconnected";
  if (s === "FAILED") return "error";
  if (s === "SCAN_QR_CODE" || s === "STARTING") return "initializing";
  return "disconnected";
}

// ── Public server actions ─────────────────────────────────────────────

export async function getWhatsAppConnection() {
  const { context, connection } = await getOwnConnection();
  return connection
    ? {
        tenantId: connection.tenantId,
        userId: connection.userId,
        sessionId: connection.sessionId,
        sessionName: connection.sessionName,
        status: connection.status,
        qrCode: connection.qrCode,
        chatInternoAtivo: connection.chatInternoAtivo,
        connectedAt: connection.connectedAt,
      }
    : {
        tenantId: context.tenantId,
        userId: context.userId,
        sessionId: null,
        sessionName: null,
        status: "disconnected",
        qrCode: null,
        chatInternoAtivo: true,
        connectedAt: null,
      };
}

export async function startWhatsAppConnection() {
  const { context, db } = await getOwnConnection();
  const sessionName = generateWahaSessionName(context.tenantId, context.userId);

  try {
    // Chamar Fastify para criar/iniciar sessão WAHA
    const result = await vpsRequest("/internal/waha/connections", {
      method: "POST",
      body: {
        tenantId: context.tenantId,
        userId: context.userId,
        sessionName,
      },
    });

    const status = normalizeWahaStatus(result.status ?? "STARTING");

    // Upsert no banco local
    let [connection] = await db
      .select()
      .from(schema.whatsappConnections)
      .where(
        and(
          eq(schema.whatsappConnections.tenantId, context.tenantId),
          eq(schema.whatsappConnections.userId, context.userId),
        ),
      )
      .limit(1);

    const values = {
      id: connection?.id ?? randomUUID(),
      tenantId: context.tenantId,
      userId: context.userId,
      sessionId: sessionName,
      sessionName,
      status,
      qrCode: null,
      webhookSecret: connection?.webhookSecret ?? randomUUID(),
      chatInternoAtivo: true,
      updatedAt: new Date(),
    };

    if (connection) {
      await db.update(schema.whatsappConnections).set(values).where(eq(schema.whatsappConnections.id, connection.id));
    } else {
      await db.insert(schema.whatsappConnections).values(values);
    }

    return { success: true, sessionId: sessionName };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível iniciar o WhatsApp.",
    };
  }
}

export async function refreshWhatsAppQr() {
  const { db, connection } = await getOwnConnection();
  if (!connection?.sessionName) return { success: false, error: "Inicie uma sessão primeiro." };

  try {
    const result = await vpsRequest(`/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/qr`);
    const status = normalizeWahaStatus(result.status ?? connection.status);
    const qrCode = status === "ready" ? null : result.qr ?? null;

    await db
      .update(schema.whatsappConnections)
      .set({
        qrCode,
        status,
        connectedAt: status === "ready" ? connection.connectedAt ?? new Date() : connection.connectedAt,
        chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo,
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnections.id, connection.id));

    return { success: true, qrCode, status };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar o QR Code.",
    };
  }
}

export async function toggleWhatsAppChatAction(): Promise<{ success: boolean; active?: boolean; error?: string }> {
  const { context, db, connection } = await getOwnConnection();
  const active = !(connection?.chatInternoAtivo ?? true);

  if (!connection) {
    await db.insert(schema.whatsappConnections).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      userId: context.userId,
      chatInternoAtivo: active,
      updatedAt: new Date(),
    });
  } else {
    await db
      .update(schema.whatsappConnections)
      .set({ chatInternoAtivo: active, updatedAt: new Date() })
      .where(eq(schema.whatsappConnections.id, connection.id));
  }

  return { success: true, active };
}

export async function getWhatsAppSessionStatus() {
  const { db, connection } = await getOwnConnection();
  if (!connection?.sessionName) return { success: false, error: "Sessão não configurada." };

  try {
    const result = await vpsRequest(`/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/status`);
    const status = normalizeWahaStatus(result.status ?? connection.status);

    await db
      .update(schema.whatsappConnections)
      .set({
        status,
        qrCode: status === "ready" ? null : connection.qrCode,
        connectedAt: status === "ready" ? connection.connectedAt ?? new Date() : connection.connectedAt,
        chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo,
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnections.id, connection.id));

    return { success: true, status, phone: result.phoneNumber ?? null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível consultar o status.",
    };
  }
}

export async function resetWhatsAppSessionAction() {
  const { db, connection } = await getOwnConnection();

  try {
    if (connection?.sessionName) {
      await vpsRequest(`/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/disconnect`, {
        method: "POST",
      });
    }
  } finally {
    if (connection) {
      await db
        .update(schema.whatsappConnections)
        .set({
          sessionId: null,
          sessionName: null,
          status: "disconnected",
          qrCode: null,
          connectedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappConnections.id, connection.id));
    }
  }

  return { success: true };
}
