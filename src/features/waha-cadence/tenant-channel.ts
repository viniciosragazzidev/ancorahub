import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { normalizeWahaRelayStatus, normalizeWahaUiStatus, type WahaUiStatus } from "./status";

/**
 * Canal WAHA da empresa: um número por tenant, operado pela diretoria para
 * atender os corretores (decisão de 25/09). Notificações oficiais continuam
 * só pela Meta (decisão de 15/09). Fala com o relay pelas mesmas rotas que a
 * conexão do corretor (`/internal/waha/connections…`), sem compartilhar
 * código ou registro com ela — o corretor segue em `whatsapp_connections`.
 */

export const TENANT_CHANNEL_LABEL = "Canal da diretoria";

type RelayResponse = {
  ok?: boolean;
  status?: string;
  providerStatus?: string;
  exists?: boolean;
  qr?: string | null;
  phoneNumber?: string | null;
  error?: string;
};

export type TenantChannelState = {
  status: WahaUiStatus;
  providerStatus: string | null;
  qrCode: string | null;
  phone: string | null;
};

export type TenantChannelView = {
  id: string;
  status: WahaUiStatus;
  phone: string | null;
  lastHealthAt: string | null;
};

export function tenantChannelSessionName(tenantId: string) {
  return `tenant_${createHash("sha256").update(`tenant-channel:${tenantId}`).digest("hex").slice(0, 16)}`;
}

function assertDirector(context: TenantContext) {
  if (context.role !== "director") throw new Error("Apenas o Diretor pode gerenciar o número da empresa.");
}

function relayBase() {
  const value = (process.env.VPS_API_URL || process.env.WAHA_API_URL || process.env.WAHA_RELAY_URL)?.trim();
  if (!value) throw new Error("VPS_API_URL não configurada no serviço do CRM.");
  return new URL(value.startsWith("http") ? value : `https://${value}`).origin;
}

async function relay(path: string, options: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {}): Promise<RelayResponse> {
  const token = (process.env.WHATSAPP_API_INTERNAL_TOKEN || process.env.VPS_INTERNAL_API_TOKEN || process.env.VPS_API_TOKEN || process.env.WAHA_RELAY_SHARED_SECRET)?.trim() ?? "";
  const response = await fetch(`${relayBase()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      "x-corretop-internal-token": token,
      Authorization: `Bearer ${token}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
  }).catch((error: unknown) => {
    throw new Error(`Serviço de WhatsApp inacessível (${error instanceof Error ? error.message : "erro de rede"}).`);
  });
  const data = (await response.json().catch(() => null)) as RelayResponse | null;
  if (response.status === 404 && path.endsWith("/state")) return { ok: false, error: "STATE_ROUTE_MISSING" };
  if (!response.ok || !data || data.ok === false) {
    throw new Error(`O serviço de WhatsApp recusou a operação (${data?.error ?? `status ${response.status}`}).`);
  }
  return data;
}

/** Estado + QR numa leitura; relays sem `/state` (infra main) caem em `/status` + `/qr`. */
async function readRelayState(sessionName: string): Promise<RelayResponse> {
  const id = encodeURIComponent(sessionName);
  const state = await relay(`/internal/waha/connections/${id}/state`, { timeoutMs: 12_000 });
  if (state.ok !== false) return state;
  const status = await relay(`/internal/waha/connections/${id}/status`);
  const qr = normalizeWahaUiStatus(status.status) === "initializing"
    ? await relay(`/internal/waha/connections/${id}/qr`).catch(() => null)
    : null;
  return { ...status, qr: qr?.qr ?? null };
}

async function findChannel(tenantId: string) {
  const [row] = await getDatabase().select().from(schema.wahaNumbers)
    .where(and(eq(schema.wahaNumbers.tenantId, tenantId), eq(schema.wahaNumbers.scope, "tenant")))
    .orderBy(desc(schema.wahaNumbers.createdAt))
    .limit(1);
  return row ?? null;
}

function uiStatusFromRow(status: string): WahaUiStatus {
  if (status === "active") return "ready";
  if (status === "error") return "error";
  if (status === "connecting" || status === "pending") return "initializing";
  return "disconnected";
}

function formatPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/@.*$/, "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

export async function getTenantChannel(context: TenantContext): Promise<TenantChannelView | null> {
  const row = await findChannel(context.tenantId);
  if (!row) return null;
  return {
    id: row.id,
    status: uiStatusFromRow(row.status),
    phone: formatPhone(row.displayPhoneNumber),
    lastHealthAt: row.lastHealthAt?.toISOString() ?? null,
  };
}

async function audit(context: TenantContext, entidadeId: string, acao: string) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "waha_number", entidadeId, acao, createdAt: new Date() });
}

/**
 * Cria (ou reaproveita) a sessão da empresa no WAHA e devolve o primeiro QR.
 * `fresh` descarta a sessão atual antes — "gerar novo QR" quando o pareamento travou.
 */
export async function startTenantChannel(context: TenantContext, options: { fresh?: boolean } = {}): Promise<TenantChannelState> {
  assertDirector(context);
  const db = getDatabase();
  const sessionName = tenantChannelSessionName(context.tenantId);
  if (options.fresh) {
    await relay(`/internal/waha/connections/${encodeURIComponent(sessionName)}/disconnect`, { method: "POST", timeoutMs: 30_000 }).catch(() => null);
  }
  const created = await relay("/internal/waha/connections", {
    method: "POST",
    body: { tenantId: context.tenantId, userId: context.userId, sessionName },
    timeoutMs: 20_000,
  });
  const live = await readRelayState(sessionName).catch(() => created);
  const status = normalizeWahaUiStatus(live.status ?? created.status ?? "STARTING");
  const phone = status === "ready" ? formatPhone(live.phoneNumber) : null;
  const now = new Date();

  const existing = await findChannel(context.tenantId);
  if (existing) {
    await db.update(schema.wahaNumbers).set({
      relaySessionId: sessionName,
      status: normalizeWahaRelayStatus(live.status ?? "STARTING"),
      ...(phone ? { displayPhoneNumber: phone } : {}),
      lastHealthAt: now,
      lastErrorCode: null,
      updatedAt: now,
    }).where(eq(schema.wahaNumbers.id, existing.id));
    await audit(context, existing.id, options.fresh ? "tenant_channel.restarted" : "tenant_channel.started");
  } else {
    const id = randomUUID();
    await db.insert(schema.wahaNumbers).values({
      id,
      relaySessionId: sessionName,
      // Unique column: a stable placeholder until the phone is known.
      displayPhoneNumber: phone ?? `pendente-${id.slice(0, 8)}`,
      tenantId: context.tenantId,
      branchId: null,
      scope: "tenant",
      label: TENANT_CHANNEL_LABEL,
      capabilities: { inbound: true, cadence: false, ai: false },
      status: normalizeWahaRelayStatus(live.status ?? "STARTING"),
      createdBy: context.userId,
      lastHealthAt: now,
      updatedAt: now,
    });
    await audit(context, id, "tenant_channel.created");
  }

  return {
    status,
    providerStatus: live.providerStatus ?? null,
    qrCode: status === "ready" ? null : (live.qr ?? created.qr ?? null),
    phone,
  };
}

/** Leitura do polling do QR: status real do WAHA; grava só quando algo mudou. */
export async function readTenantChannelState(context: TenantContext): Promise<TenantChannelState> {
  assertDirector(context);
  const row = await findChannel(context.tenantId);
  if (!row) return { status: "disconnected", providerStatus: null, qrCode: null, phone: null };
  const live = await readRelayState(row.relaySessionId);
  const status = live.exists === false ? "disconnected" : normalizeWahaUiStatus(live.status);
  const relayStatus = live.exists === false ? "offline" : normalizeWahaRelayStatus(live.status);
  const phone = status === "ready" ? formatPhone(live.phoneNumber) : null;
  if (row.status !== relayStatus || (phone && phone !== row.displayPhoneNumber)) {
    const now = new Date();
    await getDatabase().update(schema.wahaNumbers).set({
      status: relayStatus,
      ...(phone ? { displayPhoneNumber: phone } : {}),
      lastHealthAt: now,
      updatedAt: now,
    }).where(eq(schema.wahaNumbers.id, row.id));
    if (status === "ready" && row.status !== "active") await audit(context, row.id, "tenant_channel.connected");
  }
  return { status, providerStatus: live.providerStatus ?? null, qrCode: status === "initializing" ? (live.qr ?? null) : null, phone: phone ?? formatPhone(row.displayPhoneNumber) };
}

/** Encerra a sessão no WAHA (para e apaga) e remove o registro. */
export async function disconnectTenantChannel(context: TenantContext) {
  assertDirector(context);
  const row = await findChannel(context.tenantId);
  if (!row) return;
  await relay(`/internal/waha/connections/${encodeURIComponent(row.relaySessionId)}/disconnect`, { method: "POST", timeoutMs: 30_000 });
  await getDatabase().delete(schema.wahaNumbers).where(eq(schema.wahaNumbers.id, row.id));
  await audit(context, row.id, "tenant_channel.disconnected");
}
