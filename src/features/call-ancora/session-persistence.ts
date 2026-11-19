import "server-only";

import { createHash } from "node:crypto";

import { eq, inArray } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { CallAncoraSessionStore, callAncoraSessionStore, type CallAncoraPersistedSession } from "./session-store";

/**
 * Sessões do Call Âncora fora da memória: um deploy ou reinício do servidor não derruba a
 * sessão da tela nem desconecta o celular. Guardadas em `system_settings` com chaves
 * `call-ancora-runtime:*` (estado de execução, fora do cache de configurações). Sem tabela nova.
 */
const PREFIX = "call-ancora-runtime:";
const sessionSettingKey = (sessionKey: string) => `${PREFIX}session:${createHash("sha256").update(sessionKey).digest("hex")}`;
const deviceSettingKey = (tokenHash: string) => `${PREFIX}device:${tokenHash}`;

const pending = new Map<string, CallAncoraPersistedSession | null>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY_MS = 300;

async function writeSettings(entries: { key: string; value: string }[]) {
  if (!entries.length) return;
  const db = getDatabase();
  const now = new Date();
  for (const entry of entries) {
    await db.insert(schema.systemSettings)
      .values({ key: entry.key, value: entry.value, updatedAt: now })
      .onConflictDoUpdate({ target: schema.systemSettings.key, set: { value: entry.value, updatedAt: now } });
  }
}

async function flush() {
  flushTimer = null;
  const batch = [...pending.entries()];
  pending.clear();
  const writes: { key: string; value: string }[] = [];
  const deletes: string[] = [];
  for (const [sessionKey, session] of batch) {
    if (!session) {
      deletes.push(sessionSettingKey(sessionKey));
      continue;
    }
    writes.push({ key: sessionSettingKey(sessionKey), value: JSON.stringify(session) });
    if (session.deviceTokenHash) writes.push({ key: deviceSettingKey(session.deviceTokenHash), value: sessionKey });
  }
  try {
    await writeSettings(writes);
    if (deletes.length) await getDatabase().delete(schema.systemSettings).where(inArray(schema.systemSettings.key, deletes));
  } catch (error) {
    console.error("[call-ancora] não consegui guardar a sessão", error instanceof Error ? error.message : "erro inesperado");
  }
}

function schedule(sessionKey: string, session: CallAncoraPersistedSession | null) {
  // Cópia: a sessão em memória continua mudando até a gravação.
  pending.set(sessionKey, session ? JSON.parse(JSON.stringify(session)) as CallAncoraPersistedSession : null);
  if (!flushTimer) flushTimer = setTimeout(() => { void flush(); }, FLUSH_DELAY_MS);
}

const installed = globalThis as typeof globalThis & { __callAncoraPersistenceInstalled?: boolean };
if (!installed.__callAncoraPersistenceInstalled) {
  installed.__callAncoraPersistenceInstalled = true;
  callAncoraSessionStore.onPersist = schedule;
}

async function readSetting(key: string): Promise<string | null> {
  const [row] = await getDatabase()
    .select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

async function restoreBySessionKey(sessionKey: string) {
  const raw = await readSetting(sessionSettingKey(sessionKey));
  if (!raw) return;
  const saved = JSON.parse(raw) as CallAncoraPersistedSession;
  callAncoraSessionStore.restoreSession(saved);
}

/** Antes de usar a sessão da tela: se a memória perdeu (deploy), traz de volta. */
export async function ensureSessionLoaded(scope: { tenantId: string; brokerId: string }) {
  if (callAncoraSessionStore.hasSession(scope)) return;
  try {
    await restoreBySessionKey(CallAncoraSessionStore.sessionKeyFor(scope));
  } catch (error) {
    console.error("[call-ancora] não consegui recuperar a sessão", error instanceof Error ? error.message : "erro inesperado");
  }
}

/** Antes de atender o celular: se a memória perdeu (deploy), traz a sessão do token de volta. */
export async function ensureDeviceLoaded(deviceToken: string) {
  if (!deviceToken || callAncoraSessionStore.hasDevice(deviceToken)) return;
  try {
    const sessionKey = await readSetting(deviceSettingKey(CallAncoraSessionStore.deviceHashFor(deviceToken)));
    if (sessionKey) await restoreBySessionKey(sessionKey);
  } catch (error) {
    console.error("[call-ancora] não consegui recuperar a sessão do celular", error instanceof Error ? error.message : "erro inesperado");
  }
}
