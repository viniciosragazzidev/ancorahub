/**
 * Fila do Sasá sem internet (fase 3, plano §3.6): o áudio gravado sem rede fica no aparelho (IndexedDB) e é
 * enviado quando a internet volta, com a hora da gravação. No máximo 5 áudios e 24 horas; nada executa no
 * servidor antes disso. Sem IndexedDB (aba anônima antiga, teste), a fila simplesmente não existe.
 */
export const SASA_QUEUE_MAX = 5;
export const SASA_QUEUE_TTL_MS = 24 * 60 * 60_000;

export type SasaQueued = { id: string; audio: Blob; seconds: number; recordedAt: string };

/** O que fica: até 24 h, os 5 mais antigos (o que já estava esperando não perde a vez). */
export function keepQueued<T extends { recordedAt: string }>(items: T[], now: Date): T[] {
  return items
    .filter((item) => {
      const at = Date.parse(item.recordedAt);
      return Number.isFinite(at) && now.getTime() - at <= SASA_QUEUE_TTL_MS && at <= now.getTime() + 60_000;
    })
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))
    .slice(0, SASA_QUEUE_MAX);
}

/** Falha de rede (fetch sem internet) e não erro do servidor: vale guardar para depois. */
export function isOfflineError(error: unknown, online = typeof navigator === "undefined" ? true : navigator.onLine) {
  return !online || error instanceof TypeError;
}

const DB = "ancora-sasa";
const STORE = "queue";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | null> {
  return openDb().then((db) => new Promise<T | null>((resolve) => {
    if (!db) { resolve(null); return; }
    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(request ? (request.result as T) : null); };
      tx.onerror = () => { db.close(); resolve(null); };
      tx.onabort = () => { db.close(); resolve(null); };
    } catch {
      db.close();
      resolve(null);
    }
  }));
}

export const sasaQueue = {
  async list(now = new Date()): Promise<SasaQueued[]> {
    const all = ((await run<SasaQueued[]>("readonly", (store) => store.getAll())) ?? []) as SasaQueued[];
    const kept = keepQueued(all, now);
    const dropped = all.filter((item) => !kept.includes(item));
    for (const item of dropped) await this.remove(item.id);
    return kept;
  },
  /** false = não coube (fila cheia ou sem IndexedDB). */
  async add(item: SasaQueued): Promise<boolean> {
    const current = await this.list();
    if (current.length >= SASA_QUEUE_MAX) return false;
    const saved = await run("readwrite", (store) => store.put(item));
    return saved !== null;
  },
  async remove(id: string) {
    await run("readwrite", (store) => store.delete(id));
  },
};

export type SasaQueueStore = Pick<typeof sasaQueue, "list" | "add" | "remove">;
