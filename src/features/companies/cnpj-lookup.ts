/**
 * Consulta de CNPJ na BrasilAPI, sempre no servidor. Valida os dígitos antes de chamar, espera no máximo
 * `CNPJ_LOOKUP_TIMEOUT_MS` e guarda o resultado em memória por CNPJ. Só o CNPJ sai do sistema: nenhum dado
 * de lead, usuário ou empresa vai na chamada.
 */
import "server-only";

import { mapBrasilApiCnpj, type CnpjLookupData } from "./brasilapi-cnpj";
import { cnpjInputProblem, cnpjDigits } from "./cnpj";

export type CnpjLookupResult =
  | { ok: true; data: CnpjLookupData }
  | { ok: false; reason: string; retryable: boolean };

export const CNPJ_LOOKUP_TIMEOUT_MS = 5000;
const FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;

type Entry = { expiresAt: number; result: CnpjLookupResult };
const cache = new Map<string, Entry>();

export function clearCnpjLookupCache() {
  cache.clear();
}

function remember(cnpj: string, result: CnpjLookupResult, ttl: number, now: number) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cnpj, { expiresAt: now + ttl, result });
}

type Options = { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number };

export async function lookupCnpj(input: string, options: Options = {}): Promise<CnpjLookupResult> {
  const problem = cnpjInputProblem(input);
  if (problem) return { ok: false, reason: problem, retryable: false };
  const cnpj = cnpjDigits(input);
  const now = options.now ?? Date.now;
  const cached = cache.get(cnpj);
  if (cached && cached.expiresAt > now()) return cached.result;
  if (cached) cache.delete(cnpj);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? CNPJ_LOOKUP_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 404) {
      const result: CnpjLookupResult = { ok: false, reason: "A Receita não encontrou este CNPJ. Confira o número.", retryable: false };
      remember(cnpj, result, NOT_FOUND_TTL_MS, now());
      return result;
    }
    if (response.status === 400) return { ok: false, reason: "A Receita recusou este CNPJ. Confira o número.", retryable: false };
    if (response.status === 429) return { ok: false, reason: "Muitas consultas agora. Espere um minuto.", retryable: true };
    if (!response.ok) return { ok: false, reason: "A consulta de CNPJ está fora do ar agora.", retryable: true };
    const data = mapBrasilApiCnpj(await response.json().catch(() => null));
    if (!data) return { ok: false, reason: "A consulta de CNPJ voltou incompleta.", retryable: true };
    const result: CnpjLookupResult = { ok: true, data };
    remember(cnpj, result, FOUND_TTL_MS, now());
    return result;
  } catch {
    if (controller.signal.aborted) return { ok: false, reason: "A consulta de CNPJ demorou demais.", retryable: true };
    return { ok: false, reason: "Não consegui falar com a consulta de CNPJ.", retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
