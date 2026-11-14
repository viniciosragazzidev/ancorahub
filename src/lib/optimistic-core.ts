/**
 * Resposta otimista (limiar de Doherty, 400 ms): a tela muda antes do servidor responder e
 * volta sozinha se ele recusar. Lógica pura, sem React, para testar a reconciliação.
 */
export type OptimisticOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; value?: T; error?: unknown };

export async function runOptimistic<T>({
  apply,
  commit,
  rollback,
  isSuccess,
}: {
  /** Muda a tela na hora. */
  apply: () => void;
  /** Chama o servidor. */
  commit: () => Promise<T>;
  /** Desfaz o `apply` quando o servidor recusa ou a chamada falha. */
  rollback: () => void;
  /** Lê a resposta do servidor (as actions do repo devolvem `{ success }` ou `{ ok }`). */
  isSuccess: (value: T) => boolean;
}): Promise<OptimisticOutcome<T>> {
  apply();
  try {
    const value = await commit();
    if (isSuccess(value)) return { ok: true, value };
    rollback();
    return { ok: false, value };
  } catch (error) {
    rollback();
    return { ok: false, error };
  }
}
