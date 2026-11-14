/**
 * "Primeira vez hoje": frequência de uso decide a animação (docs/ux/motion-frequencia.md).
 * O que o corretor vê dezenas de vezes por dia anima só na primeira abertura do dia;
 * nas seguintes já aparece no estado final. Lógica pura, sem React, para testar.
 */

export const FIRST_TIME_TODAY_PREFIX = "lite:primeira-vez-hoje:";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Lembra na memória o que o storage não conseguiu gravar (aba anônima, cota cheia). */
const sessionSeen = new Set<string>();

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dia civil em America/Sao_Paulo, "YYYY-MM-DD". */
export function saoPauloDayKey(now: Date): string {
  return dayFormatter.format(now);
}

export function firstTimeTodayStorageKey(key: string): string {
  return `${FIRST_TIME_TODAY_PREFIX}${key}`;
}

/**
 * true só quando dá para afirmar que é a primeira vez no dia. Sem storage ou com
 * storage quebrado responde false ("já visto"): na dúvida, não anima.
 */
export function isFirstTimeToday(storage: StorageLike | null | undefined, key: string, now: Date): boolean {
  const day = saoPauloDayKey(now);
  if (sessionSeen.has(`${key}:${day}`)) return false;
  if (!storage) return false;
  try {
    return storage.getItem(firstTimeTodayStorageKey(key)) !== day;
  } catch {
    return false;
  }
}

/** Marca como visto hoje. Se o storage falhar, a memória da sessão segura até recarregar. */
export function markSeenToday(storage: StorageLike | null | undefined, key: string, now: Date): void {
  const day = saoPauloDayKey(now);
  sessionSeen.add(`${key}:${day}`);
  try {
    storage?.setItem(firstTimeTodayStorageKey(key), day);
  } catch {
    // Storage indisponível: a memória da sessão já evita repetir a animação.
  }
}

/** Só para testes. */
export function resetFirstTimeTodayMemory(): void {
  sessionSeen.clear();
}
