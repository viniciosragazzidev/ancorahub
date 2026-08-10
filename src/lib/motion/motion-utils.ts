/**
 * Utilitários auxiliares de motion para máquinas de estado assíncronas e reduced motion.
 */

export type AsyncVisualState = "idle" | "loading" | "success" | "error";

/**
 * Mapeia estado de carregamento/sucesso em estado assíncrono estrito único
 * para evitar estados concorrentes (ex: loading = true e error = true ao mesmo tempo).
 */
export function getAsyncVisualState(
  isLoading: boolean,
  isSuccess: boolean,
  isError: boolean
): AsyncVisualState {
  if (isLoading) return "loading";
  if (isSuccess) return "success";
  if (isError) return "error";
  return "idle";
}

/**
 * Retorna as variantes adaptadas ao modo de movimento reduzido (prefers-reduced-motion).
 * Elimina deslocamentos físicos (y, x, scale) mantendo somente opacidade e transição de cor.
 */
export function sanitizeVariantForReducedMotion<T extends Record<string, any>>(variant: T): T {
  const result: Record<string, any> = {};
  for (const key in variant) {
    if (Object.prototype.hasOwnProperty.call(variant, key)) {
      const val = variant[key];
      if (typeof val === "object" && val !== null) {
        const { y, x, scale, ...rest } = val;
        result[key] = rest;
      } else {
        result[key] = val;
      }
    }
  }
  return result as T;
}
