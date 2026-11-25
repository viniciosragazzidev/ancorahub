import "server-only";

import postgres from "postgres";
import { sql } from "drizzle-orm";

import { databaseSslOption, getDatabase, getListenDatabaseUrl } from "@/shared/db/client";

/**
 * Avisos em tempo real sem o Supabase Realtime (25/11). Quem grava chama pg_notify no canal
 * abaixo; cada processo do app mantém UMA conexão em LISTEN e repassa o aviso às abas abertas
 * (rota SSE /api/realtime/stream) do tópico certo. Funciona no Postgres do Supabase hoje e no
 * banco próprio depois da migração, sem mudar nada.
 *
 * O aviso não carrega dado de negócio: só o tipo e o id da notificação ou o nome do domínio.
 */
export const REALTIME_CHANNEL = "ancorahub_sync";

export type RealtimeListener = (signal: unknown) => void;
export type RealtimeStatusListener = (live: boolean) => void;

type Bus = {
  topics: Map<string, Set<RealtimeListener>>;
  statusListeners: Set<RealtimeStatusListener>;
  live: boolean;
  starting: Promise<void> | null;
  connection: ReturnType<typeof postgres> | null;
};

// No processo, não no módulo: o build inclui este arquivo em mais de um bundle.
const BUS_KEY = Symbol.for("ancorahub.realtime.bus");
const holder = globalThis as typeof globalThis & { [BUS_KEY]?: Bus };
function bus(): Bus {
  return (holder[BUS_KEY] ??= { topics: new Map(), statusListeners: new Set(), live: false, starting: null, connection: null });
}

function setLive(live: boolean) {
  const state = bus();
  if (state.live === live) return;
  state.live = live;
  for (const listener of state.statusListeners) listener(live);
}

/** Separa a mensagem do canal; ignora o que não for do formato esperado. */
export function parseRealtimeMessage(raw: string): { topic: string; signal: unknown } | null {
  try {
    const parsed = JSON.parse(raw) as { t?: unknown; s?: unknown };
    if (typeof parsed.t !== "string" || !parsed.t || parsed.s === undefined) return null;
    return { topic: parsed.t, signal: parsed.s };
  } catch {
    return null;
  }
}

function deliver(raw: string) {
  const message = parseRealtimeMessage(raw);
  if (!message) return;
  const listeners = bus().topics.get(message.topic);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(message.signal);
    } catch {
      // Uma aba com problema não derruba as outras.
    }
  }
}

function ensureListening(): Promise<void> {
  const state = bus();
  if (state.connection) return Promise.resolve();
  state.starting ??= (async () => {
    const ssl = databaseSslOption();
    const connection = postgres(getListenDatabaseUrl(), {
      max: 1,
      prepare: false,
      ...(ssl ? { ssl } : {}),
      connect_timeout: 10,
      // A conexão de LISTEN fica aberta; postgres.js reconecta e refaz o LISTEN sozinho.
      idle_timeout: 0,
      max_lifetime: null,
      onnotice: () => {},
      onclose: () => setLive(false),
    });
    try {
      await connection.listen(REALTIME_CHANNEL, deliver, () => setLive(true));
      state.connection = connection;
    } catch (error) {
      setLive(false);
      await connection.end({ timeout: 1 }).catch(() => undefined);
      throw error;
    } finally {
      state.starting = null;
    }
  })();
  return state.starting;
}

/** Assina um tópico. Devolve a função para sair. Falha ao conectar = a aba cai no modo de conferência periódica. */
export async function subscribeRealtimeTopic(topic: string, listener: RealtimeListener, onStatus?: RealtimeStatusListener) {
  const state = bus();
  let listeners = state.topics.get(topic);
  if (!listeners) state.topics.set(topic, (listeners = new Set()));
  listeners.add(listener);
  if (onStatus) state.statusListeners.add(onStatus);
  const unsubscribe = () => {
    const current = state.topics.get(topic);
    current?.delete(listener);
    if (current && current.size === 0) state.topics.delete(topic);
    if (onStatus) state.statusListeners.delete(onStatus);
  };
  try {
    await ensureListening();
  } catch (error) {
    unsubscribe();
    throw error;
  }
  return unsubscribe;
}

export function isRealtimeBusLive() {
  return bus().live;
}

/** Publica um aviso. Melhor esforço: quem chama não falha se o aviso não sair. */
export async function publishRealtimeTopic(topic: string, signal: unknown): Promise<boolean> {
  const payload = JSON.stringify({ t: topic, s: signal });
  // Limite do NOTIFY é 8000 bytes; o aviso tem poucas dezenas.
  if (payload.length > 7_900) return false;
  try {
    await getDatabase().execute(sql`select pg_notify(${REALTIME_CHANNEL}, ${payload})`);
    return true;
  } catch {
    return false;
  }
}
