"use server";

import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { wahaActionCodeFromMessage } from "@/lib/waha-error-codes";
import { normalizeWahaUiStatus } from "@/features/waha-cadence/status";

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
  /** Status bruto do WAHA (SCAN_QR_CODE, STARTING, WORKING…). Ausente em Fastify antigo. */
  providerStatus?: string;
  /** Falso quando a sessão não existe mais no WAHA (ex.: WAHA reiniciado sem volume). */
  exists?: boolean;
  reused?: boolean;
  qr?: string | null;
  phoneNumber?: string | null;
  error?: string;
  timestamp?: string;
};

/**
 * Leitura única de estado + QR. Fastify sem a rota `/state` (deploy antigo)
 * responde 404: cai para status + qr separados, mantendo o fluxo funcional
 * até o serviço ser redeployado.
 */
async function readConnectionState(sessionName: string): Promise<WahaConnectionResponse> {
  const id = encodeURIComponent(sessionName);
  try {
    return await vpsRequest(`/internal/waha/connections/${id}/state`, { timeoutMs: 12_000 });
  } catch (error) {
    if (!(error instanceof Error) || !/\b404\b|não foi encontrada/i.test(error.message)) throw error;
    const status = await vpsRequest(`/internal/waha/connections/${id}/status`);
    const qr = normalizeWahaUiStatus(status.status) === "initializing"
      ? await vpsRequest(`/internal/waha/connections/${id}/qr`).catch(() => null)
      : null;
    return { ...status, qr: qr?.qr ?? null };
  }
}

async function vpsRequest<T extends WahaConnectionResponse>(
  path: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const base = vpsBaseUrl();
  if (!base)
    throw new Error("VPS_API_URL não configurada no serviço de frontend. Verifique as variáveis de ambiente do Coolify.");

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
    // Erro de rede / TLS / DNS / timeout. O código WAHA_UNREACHABLE (ou
    // WAHA_TIMEOUT) é embutido na mensagem para que a classificação
    // preservada no retorno da action não colapse em WAHA_ERROR genérico.
    const detail = error instanceof Error ? error.message : String(error);
    const networkCode = /timeout|aborted/i.test(detail) ? "WAHA_TIMEOUT" : "WAHA_UNREACHABLE";
    throw new Error(
      `${networkCode} Não foi possível conectar ao serviço de WhatsApp em ${base}. Verifique se o VPS está online e acessível. Detalhes: ${detail}`,
    );
  }
}

function wahaActionErrorCode(message: string) {
  return wahaActionCodeFromMessage(message);
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
 * Por padrão é idempotente. Com `forceNew`, a sessão remota é removida e
 * recriada antes de buscar o QR, invalidando qualquer código anterior.
 */
export async function startWhatsAppConnection(options: { forceNew?: boolean } = {}) {
  const { context, db } = await getOwnConnection();
  const sessionName = generateWahaSessionName(context.tenantId, context.userId);

  try {
    const result = await vpsRequest(options.forceNew
      ? `/internal/waha/connections/${encodeURIComponent(sessionName)}/reconnect`
      : "/internal/waha/connections", {
      method: "POST",
      ...(options.forceNew ? {} : { body: {
        tenantId: context.tenantId,
        userId: context.userId,
        sessionName,
      } }),
      // A rotação precisa parar, sair, remover e só então recriar a sessão.
      // Cada etapa tem timeout próprio no Fastify; 60s evita que a Server
      // Action abandone o processo enquanto o WAHA ainda confirma a remoção.
      timeoutMs: options.forceNew ? 60_000 : 15_000,
    });

    let status = normalizeWahaUiStatus(result.status ?? "STARTING");
    let providerStatus: string | null = result.providerStatus ?? null;

    // Sessão já conectada: nada de QR. Caso contrário, uma leitura de estado
    // devolve status bruto + QR (quando o WAHA já está em SCAN_QR_CODE). Um QR
    // ainda inexistente não é erro — o polling do dialog o busca em seguida.
    let qrCode: string | null = status === "ready" ? null : (result.qr ?? null);
    if (status !== "ready" && !qrCode) {
      try {
        const state = await readConnectionState(sessionName);
        status = normalizeWahaUiStatus(state.status ?? result.status);
        providerStatus = state.providerStatus ?? providerStatus;
        qrCode = status === "ready" ? null : (state.qr ?? null);
      } catch {
        // mantém o status devolvido pelo start
      }
    }
    const isReady = status === "ready";

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
      // O QR nunca é persistido: ele rotaciona a cada 20s no WAHA e uma cópia
      // no banco só serviria para reexibir um código já expirado.
      qrCode: null,
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

    return { success: true, sessionId: sessionName, qrCode, status, providerStatus };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o WhatsApp.";
    // Normalizar código de erro para o frontend decidir UI
    const code = /já existe|409/i.test(message) ? "SESSION_EXISTS" : wahaActionErrorCode(message);
    return { success: false, error: message, code };
  }
}

/**
 * Leitura de pareamento usada pelo polling do dialog: UMA ida ao Fastify traz
 * status, status bruto do WAHA e o QR atual. Cada QR vem direto do provider —
 * ele rotaciona (60s o primeiro, 20s os demais) e nunca é reaproveitado.
 *
 * O banco só é escrito quando o status muda; escrever a cada 500 ms era o
 * maior custo do polling e disputava linha com o webhook de status.
 */
export async function pollWhatsAppConnection() {
  const { db, connection } = await getOwnConnection();
  if (!connection?.sessionName)
    return { success: false as const, error: "Sessão não configurada.", code: "NO_SESSION" };

  try {
    const result = await readConnectionState(connection.sessionName);
    // Sessão inexistente no WAHA (reinício sem volume, remoção manual):
    // o CRM não pode continuar afirmando "conectando".
    const status = result.exists === false ? "disconnected" : normalizeWahaUiStatus(result.status ?? connection.status);
    const qrCode = status === "initializing" ? (result.qr ?? null) : null;

    const becameReady = status === "ready" && !connection.connectedAt;
    if (connection.status !== status || becameReady || connection.qrCode) {
      await db
        .update(schema.whatsappConnections)
        .set({
          status,
          qrCode: null,
          connectedAt: status === "ready" ? (connection.connectedAt ?? new Date()) : connection.connectedAt,
          chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo,
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappConnections.id, connection.id));
    }

    return {
      success: true as const,
      status,
      providerStatus: result.providerStatus ?? null,
      qrCode,
      phone: result.phoneNumber ?? null,
      sessionExists: result.exists !== false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível consultar a conexão.";
    return { success: false as const, error: message, code: wahaActionErrorCode(message) };
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
    const status = normalizeWahaUiStatus(result.status ?? connection.status);

    // Só escreve quando algo mudou: o badge consulta a cada 5 s e cada escrita
    // desnecessária disputava a linha com o webhook de status.
    const becameReady = status === "ready" && !connection.connectedAt;
    if (connection.status !== status || becameReady || connection.qrCode) {
      await db
        .update(schema.whatsappConnections)
        .set({
          status,
          qrCode: null,
          connectedAt:
            status === "ready" ? (connection.connectedAt ?? new Date()) : connection.connectedAt,
          chatInternoAtivo: status === "ready" ? true : connection.chatInternoAtivo,
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappConnections.id, connection.id));
    }

    return {
      success: true,
      status,
      providerStatus: result.providerStatus ?? null,
      phone: result.phoneNumber ?? null,
    };
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
  if (!base) return { ok: false, step: "config", error: "VPS_API_URL não configurada no serviço de frontend." };

  try {
    const healthRes = await fetch(`${base}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!healthRes.ok)
      return { ok: false, step: "health", error: `Health check retornou ${healthRes.status}` };
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
    const detail = cause?.code ?? (error instanceof Error ? error.message : String(error));
    const kind = /ENOTFOUND|EAI_AGAIN/i.test(detail)
      ? "dns"
      : /TLS|SSL|handshake|certificate/i.test(detail)
        ? "tls"
        : /timeout|aborted/i.test(detail)
          ? "timeout"
          : "network";
    return {
      ok: false,
      step: "connectivity",
      kind,
      base,
      error: `Não foi possível acessar ${base} (${kind}). ${detail}`,
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
    const code = wahaActionErrorCode(message);
    console.warn("[waha] reset: disconnect failed:", { code, message: message.slice(0, 300) });
    return {
      success: false,
      error: "Não foi possível confirmar a desconexão da sessão WhatsApp.",
      code,
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

/**
 * Força a desconexão local SEM chamar o VPS.
 *
 * Use quando o VPS está inacessível (WAHA_UNREACHABLE) e o usuário precisa
 * liberar a sessão no CRM. O registro remoto no WAHA pode permanecer ativo
 * até o timeout natural do serviço.
 *
 * AVISO: Esta operação NÃO garante que a sessão WAHA foi encerrada.
 * O usuário deve estar ciente de que pode haver uma sessão órfã no servidor.
 */
export async function forceDisconnectWhatsAppSession() {
  const { db, connection } = await getOwnConnection();

  if (!connection) {
    return { success: true };
  }

  console.warn("[waha] force disconnect: limpeza local sem confirmação do VPS", {
    sessionName: connection.sessionName,
    tenantId: connection.tenantId,
    userId: connection.userId,
  });

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

  return { success: true, forced: true };
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
    const status = normalizeWahaUiStatus(result.status ?? "STARTING");
    const state =
      status === "ready"
        ? null
        : await readConnectionState(connection.sessionName).catch(() => null);
    const qrCode = status === "ready" ? null : (state?.qr ?? null);

    await db
      .update(schema.whatsappConnections)
      .set({
        status,
        qrCode: null,
        connectedAt: status === "ready" ? (connection.connectedAt ?? new Date()) : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.whatsappConnections.id, connection.id));

    return {
      success: true,
      sessionId: connection.sessionName,
      status,
      providerStatus: state?.providerStatus ?? result.providerStatus ?? null,
      qrCode,
    };
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
