/** Per-process limits. Coolify currently runs one Node instance; scale-out needs a shared store. */
export const EXTENSION_RATE_LIMITS = {
  resolve: { requests: 60, windowMs: 60_000 },
  accept: { requests: 10, windowMs: 60_000 },
  inbox: { requests: 200, windowMs: 3_600_000 },
  default: { requests: 60, windowMs: 60_000 },
} as const;
export class ExtensionRateLimitError extends Error {
  constructor(readonly retryAfter: number) { super("RATE_LIMITED"); }
}
export function extensionRouteKey(request: Request) {
  return new URL(request.url).pathname
    .replace(/\/leads\/[^/]+\/(status|feedback|reply-suggestions)$/, "/leads/:id/$1")
    .replace(/\/offers\/[^/]+\/(accept|decline)$/, "/offers/:id/$1")
    .replace(/\/suggestions\/[^/]+\/feedback$/, "/suggestions/:id/feedback");
}
export function createExtensionRateLimiter() {
  const buckets = new Map<string, { timestamps: number[]; expiresAt: number }>();
  let nextCleanup = 0;
  return (route: string, sessionId: string, now = Date.now()) => {
    if (now >= nextCleanup) {
      for (const [key, value] of buckets) if (value.expiresAt <= now) buckets.delete(key);
      nextCleanup = now + 60_000;
    }
    const limits = route.endsWith("/leads/resolve") ? EXTENSION_RATE_LIMITS.resolve
      : /\/offers\/[^/]+\/(accept|decline)$/.test(route) ? EXTENSION_RATE_LIMITS.accept
      : route.endsWith("/inbox") ? EXTENSION_RATE_LIMITS.inbox : EXTENSION_RATE_LIMITS.default;
    const key = route + ":" + sessionId;
    const timestamps = (buckets.get(key)?.timestamps ?? []).filter((at) => now - at < limits.windowMs);
    if (timestamps.length >= limits.requests) {
      throw new ExtensionRateLimitError(Math.max(1, Math.ceil((timestamps[0] + limits.windowMs - now) / 1000)));
    }
    timestamps.push(now);
    buckets.set(key, { timestamps, expiresAt: now + limits.windowMs });
  };
}
export const enforceExtensionRateLimit = createExtensionRateLimiter();

/** Falhas do exchange por IP: 10 por minuto. Sucesso não conta; a falha de qualquer tipo conta. */
export const EXTENSION_EXCHANGE_FAILURE_LIMIT = { requests: 10, windowMs: 60_000 } as const;

/**
 * Conta só as falhas. verificar() bloqueia quando a janela já tem o limite de falhas; registrarFalha() guarda uma.
 * Mesmo desenho do limitador acima: por processo, e a limpeza acontece de tempos em tempos.
 */
export function createFailureLimiter(limit: { requests: number; windowMs: number }) {
  const falhas = new Map<string, number[]>();
  let nextCleanup = 0;
  const recentes = (chave: string, agora: number) => (falhas.get(chave) ?? []).filter((at) => agora - at < limit.windowMs);
  return {
    verificar(chave: string, agora = Date.now()) {
      const atuais = recentes(chave, agora);
      if (atuais.length >= limit.requests) {
        throw new ExtensionRateLimitError(Math.max(1, Math.ceil((atuais[0] + limit.windowMs - agora) / 1000)));
      }
    },
    registrarFalha(chave: string, agora = Date.now()) {
      if (agora >= nextCleanup) {
        for (const [key, value] of falhas) if (!value.some((at) => agora - at < limit.windowMs)) falhas.delete(key);
        nextCleanup = agora + 60_000;
      }
      falhas.set(chave, [...recentes(chave, agora), agora]);
    },
  };
}

export const exchangeFailures = createFailureLimiter(EXTENSION_EXCHANGE_FAILURE_LIMIT);

/** IP do cliente atrás do proxy: o último endereço do X-Forwarded-For é o que o proxy viu (o primeiro pode ser forjado). */
export function ipDoCliente(request: Request) {
  const encaminhados = (request.headers.get("x-forwarded-for") ?? "").split(",").map((ip) => ip.trim()).filter(Boolean);
  return encaminhados.at(-1) ?? request.headers.get("x-real-ip")?.trim() ?? "sem-ip";
}
