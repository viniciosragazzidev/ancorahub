"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// ── WAHA via Fastify ──────────────────────────────────────────────────

function vpsBaseUrl() {
  const value = (
    process.env.VPS_API_URL ||
    process.env.WAHA_API_URL ||
    process.env.WAHA_RELAY_URL ||
    process.env.NEXT_PUBLIC_VPS_API_URL
  )?.trim();
  if (!value) return null;
  try {
    const raw = value.startsWith("http") ? value : `https://${value}`;
    const url = new URL(raw);
    return url.origin;
  } catch {
    return null;
  }
}

function vpsHeaders(hasJsonBody: boolean) {
  const token = (
    process.env.WHATSAPP_API_INTERNAL_TOKEN ||
    process.env.VPS_INTERNAL_API_TOKEN ||
    process.env.VPS_API_TOKEN ||
    process.env.WAHA_RELAY_SHARED_SECRET
  )?.trim() ?? "";
  return {
    ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
    "X-CorreTop-Internal-Token": token,
    "x-corretop-internal-token": token,
    Authorization: `Bearer ${token}`,
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
  options: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const base = vpsBaseUrl();
  if (!base)
    throw new Error("VPS_API_URL não configurada no Vercel. Verifique as variáveis de ambiente.");

  const url = `${base}${path}`;
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: vpsHeaders(options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
    });

    const data = (await response.json().catch(() => null)) as T | null;
    if (!response.ok || !data?.ok) {
      const detail = data && "error" in data ? String(data.error) : `status ${response.status}`;
      const routeHint =
        response.status === 404
          ? ` A rota ${options.method ?? "GET"} ${path} não foi encontrada no servidor. Verifique se o Fastify service no VPS foi reiniciado com as rotas mais recentes.`
          : "";
      throw new Error(`WhatsApp (${detail})${routeHint}`);
    }
    return data;
  } catch (error) {
    if (error instanceof Error && /VPS_API_URL não configurada/.test(error.message)) throw error;
    if (error instanceof Error && /WAHA \(/.test(error.message)) throw error;
    // Erro de rede / timeout / DNS
    throw new Error(
      `Não foi possível conectar ao serviço de WhatsApp em ${base}. Verifique se o VPS está online e acessível. Detalhes: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function wahaActionErrorCode(message: string) {
  const code = message.match(/\b(WAHA_(?:TIMEOUT|UNAVAILABLE|UNAUTHORIZED|INTERNAL_ERROR|BAD_RESPONSE))\b/)?.[1];
  return code ?? "WAHA_ERROR";
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
  if (s === "CONNECTED") return "ready";
  if (s === "STOPPED") return "disconnected";
  if (s === "FAILED") return "error";
  if (s === "ERROR") return "error";
  if (s === "SCAN_QR_CODE" || s === "STARTING" || s === "WAITING_QR") return "initializing";
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

/**
 * Inicia ou retoma conexão WhatsApp.
 *
 * Idempotente: se a sessão já existe no WAHA, reutiliza em vez de destruir.
 * NÃO remove sessão existente — isso invalidava QR em pareamento.
 */
export async function startWhatsAppConnection() {
  const { context, db } = await getOwnConnection();
  const sessionName = generateWahaSessionName(context.tenantId, context.userId);

  try {
    // Chamar Fastify para criar/iniciar sessão WAHA (idempotente)
    // O endpoint /connections já trata: CONNECTED→retorna, WAITING_QR→retorna, STOPPED→reinicia
    const result = await vpsRequest("/internal/waha/connections", {
      method: "POST",
      body: {
        tenantId: context.tenantId,
        userId: context.userId,
        sessionName,
      },
    });

    const status = normalizeWahaStatus(result.status ?? "STARTING");
    const isReady = status === "ready";

    // Se a sessão já estava CONNECTED, não buscar QR
    let qrCode: string | null = null;
    if (!isReady) {
      try {
        const qrResult = await vpsRequest(
          `/internal/waha/connections/${encodeURIComponent(sessionName)}/qr`,
        );
        const qrStatus = normalizeWahaStatus(qrResult.status ?? status);
        qrCode = qrStatus === "ready" ? null : (qrResult.qr ?? null);
      } catch {
        // QR pode não estar disponível ainda — o polling vai buscar depois
      }
    }

    // Upsert no banco local
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

    const values = {
      id: connection?.id ?? randomUUID(),
      tenantId: context.tenantId,
      userId: context.userId,
      sessionId: sessionName,
      sessionName,
      status,
      qrCode,
      webhookSecret: connection?.webhookSecret ?? randomUUID(),
      chatInternoAtivo: status === "ready" ? true : (connection?.chatInternoAtivo ?? true),
      connectedAt: isReady
        ? (connection?.connectedAt ?? new Date())
        : (connection?.connectedAt ?? null),
      updatedAt: new Date(),
    };

    if (connection) {
      await db
        .update(schema.whatsappConnections)
        .set(values)
        .where(eq(schema.whatsappConnections.id, connection.id));
    } else {
      await db.insert(schema.whatsappConnections).values(values);
    }

    return { success: true, sessionId: sessionName, qrCode, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o WhatsApp.";
    // Normalizar código de erro para o frontend decidir UI
    const code = /já existe|409/i.test(message) ? "SESSION_EXISTS" : wahaActionErrorCode(message);
    return { success: false, error: message, code };
  }
}

export async function refreshWhatsAppQr() {
  const { db, connection } = await getOwnConnection();
  if (!connection?.sessionName)
    return { success: false, error: "Inicie uma sessão primeiro.", code: "NO_SESSION" };

  try {
    const result = await vpsRequest(
      `/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/qr`,
    );
    const status = normalizeWahaStatus(result.status ?? connection.status);
    const qrCode = status === "ready" ? null : (result.qr ?? null);

    await db
      .update(schema.whatsappConnections)
      .set({
        qrCode,
        status,
        connectedAt:
          status === "ready" ? (connection.connectedAt ?? new Date()) : connection.connectedAt,
        chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo,
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnections.id, connection.id));

    return { success: true, qrCode, status };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível atualizar o QR Code.";
    const code = /QR|qr/i.test(message) ? "QR_ERROR" : wahaActionErrorCode(message);
    return { success: false, error: message, code };
  }
}

export async function toggleWhatsAppChatAction(): Promise<{
  success: boolean;
  active?: boolean;
  error?: string;
}> {
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
  if (!connection?.sessionName)
    return { success: false, error: "Sessão não configurada.", code: "NO_SESSION" };

  try {
    const result = await vpsRequest(
      `/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/status`,
    );
    const status = normalizeWahaStatus(result.status ?? connection.status);

    await db
      .update(schema.whatsappConnections)
      .set({
        status,
        qrCode: status === "ready" ? null : connection.qrCode,
        connectedAt:
          status === "ready" ? (connection.connectedAt ?? new Date()) : connection.connectedAt,
        chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo,
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnections.id, connection.id));

    return { success: true, status, phone: result.phoneNumber ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar o status.";
    const code = wahaActionErrorCode(message);
    return { success: false, error: message, code };
  }
}

/**
 * Diagnóstico: testa conectividade com o VPS Fastify.
 * Pode ser chamada do client para entender o que está falhando.
 */
export async function diagnoseWahaConnection() {
  const base = vpsBaseUrl();
  if (!base) return { ok: false, step: "config", error: "VPS_API_URL não configurada no Vercel." };

  try {
    const healthRes = await fetch(`${base}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!healthRes.ok)
      return { ok: false, step: "health", error: `Health check retornou ${healthRes.status}` };
  } catch (error) {
    return {
      ok: false,
      step: "connectivity",
      error: `Não foi possível acessar ${base}. ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  try {
    const wahaHealth = await vpsRequest("/internal/waha/health");
    return { ok: true, step: "waha", status: wahaHealth.status, timestamp: wahaHealth.timestamp };
  } catch (error) {
    return {
      ok: false,
      step: "waha",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function resetWhatsAppSessionAction() {
  const { db, connection } = await getOwnConnection();

  try {
    if (connection?.sessionName) {
      await vpsRequest(
        `/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/disconnect`,
        {
          method: "POST",
          // stop + logout + delete podem consumir até 15 s no WAHA. A margem
          // evita que o CRM cancele uma desconexão que ainda está sendo concluída.
          timeoutMs: 22_000,
        },
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.warn("[waha] reset: disconnect failed:", message);
    return {
      success: false,
      error: "Não foi possível confirmar a desconexão da sessão WhatsApp.",
      code: wahaActionErrorCode(message),
    };
  }

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

  return { success: true };
}

/** Recupera uma sessão WAHA falhada mantendo a identidade determinística do corretor. */
export async function recoverWhatsAppFailedSessionAction() {
  const { db, connection } = await getOwnConnection();
  if (!connection?.sessionName)
    return { success: false, error: "Sessão não configurada.", code: "NO_SESSION" };

  try {
    const result = await vpsRequest(
      `/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/recover`,
      {
        method: "POST",
      },
    );
    const status = normalizeWahaStatus(result.status ?? "STARTING");
    const qrResult =
      status === "ready"
        ? null
        : await vpsRequest(
            `/internal/waha/connections/${encodeURIComponent(connection.sessionName)}/qr`,
          ).catch(() => null);
    const qrCode = status === "ready" ? null : (qrResult?.qr ?? null);

    await db
      .update(schema.whatsappConnections)
      .set({
        status,
        qrCode,
        connectedAt: status === "ready" ? (connection.connectedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnections.id, connection.id));

    return { success: true, sessionId: connection.sessionName, status, qrCode };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível recuperar a sessão WhatsApp.";
    return {
      success: false,
      error: message,
      code: wahaActionErrorCode(message),
    };
  }
}
