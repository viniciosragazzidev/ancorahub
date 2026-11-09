/**
 * Variações de texto da conversa de pós-venda (09/11): 2 ou 3 jeitos de dizer cada etapa, escolhidos
 * de forma determinística pelo id da pesquisa. A mesma pesquisa sempre usa o mesmo jeito (retentativa
 * idempotente manda o mesmo texto) e pesquisas diferentes não soam iguais. Sem semente, a primeira
 * variação (o texto de sempre).
 */
export function variantIndex(seed: string | null | undefined, key: string, count: number) {
  if (!seed || count <= 1) return 0;
  // FNV-1a 32 bits: estável entre execuções e sem dependência de node:crypto.
  let hash = 0x811c9dc5;
  const input = `${seed}:${key}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % count;
}

export function pickVariant(seed: string | null | undefined, key: string, variants: readonly string[]) {
  return variants[variantIndex(seed, key, variants.length)] ?? variants[0] ?? "";
}

/** Primeiro nome, sem "corretor" genérico duplicado. */
export function firstName(value: string | null | undefined, fallback: string) {
  return (value ?? "").trim().split(/\s+/)[0] || fallback;
}
