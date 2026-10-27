import "server-only";

import { TtlCache } from "@/shared/cache/ttl-cache";
import type { TenantContext } from "@/shared/auth/types";

import { isLiveStatusEnabled } from "./flag";
import { loadDistributionEngineSeal } from "./loaders";
import { LIVE_PROVIDERS } from "./registry";
import { resolveLiveScope } from "./scope";
import type { LiveSeal, LiveStatus, LiveStatusId, LiveStatusPayload } from "./types";
import { canSeeDistributionEngineSeal, visibleStatusIds } from "./visibility";

/**
 * Cache curto compartilhado por escopo (todos os diretores da empresa leem a mesma linha; cada gestor a da unidade).
 * O CRM roda num processo Node só: um TtlCache por status basta e junta pedidos simultâneos numa leitura.
 * O pool das telas tem 4 conexões; por isso cada status é 1 consulta agregada e o cache segura a repetição.
 */
const caches = new Map<string, TtlCache<LiveStatus | null>>();
const sealCache = new TtlCache<LiveSeal>(20_000, 200);
/** Último valor bom de cada status, para quando o provedor passa do orçamento de tempo. */
const lastGood = new Map<string, LiveStatus>();
const LAST_GOOD_LIMIT = 500;

/** Um provedor lento devolve o último valor com `stale: true` em vez de segurar a página. */
export const LIVE_STATUS_BUDGET_MS = 2_500;

function cacheFor(id: LiveStatusId) {
  let cache = caches.get(id);
  if (!cache) {
    cache = new TtlCache<LiveStatus | null>(LIVE_PROVIDERS[id].ttlMs, 200);
    caches.set(id, cache);
  }
  return cache;
}

class BudgetExceeded extends Error {}

async function withBudget<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new BudgetExceeded()), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}

function remember(key: string, status: LiveStatus) {
  if (lastGood.size >= LAST_GOOD_LIMIT && !lastGood.has(key)) {
    const oldest = lastGood.keys().next().value;
    if (oldest !== undefined) lastGood.delete(oldest);
  }
  lastGood.set(key, status);
}

async function loadOne(id: LiveStatusId, scopeKey: string, load: () => Promise<LiveStatus | null>): Promise<LiveStatus | null> {
  const key = `${id}:${scopeKey}`;
  try {
    const status = await withBudget(cacheFor(id).getOrLoad(key, load), LIVE_STATUS_BUDGET_MS);
    if (status) remember(key, status);
    return status;
  } catch (error) {
    if (!(error instanceof BudgetExceeded)) {
      console.warn("[live-status] provider failed", { id, message: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    }
    const previous = lastGood.get(key);
    return previous ? { ...previous, stale: true } : null;
  }
}

/**
 * Os status vivos que este usuário pode ver agora. Chave da empresa desligada ou papel sem escopo: null, e a tela
 * fica igual à de hoje. Tenant, papel e recorte vêm só da sessão.
 */
export async function getLiveStatuses(context: TenantContext, now = new Date()): Promise<LiveStatusPayload | null> {
  if (!(await isLiveStatusEnabled(context.tenantId))) return null;
  const scope = resolveLiveScope(context);
  if (!scope) return null;
  const ids = visibleStatusIds(scope.role);
  const [statuses, seal] = await Promise.all([
    Promise.all(ids.map((id) => loadOne(id, scope.key, () => LIVE_PROVIDERS[id].load(scope, now)))),
    canSeeDistributionEngineSeal(scope.role)
      ? withBudget(sealCache.getOrLoad(scope.key, () => loadDistributionEngineSeal(scope, now)), LIVE_STATUS_BUDGET_MS).catch(() => null)
      : Promise.resolve(null),
  ]);
  return {
    statuses: statuses.filter((status): status is LiveStatus => status !== null),
    seals: seal ? [seal] : [],
  };
}
