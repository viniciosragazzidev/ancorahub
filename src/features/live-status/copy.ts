/** Plural pt-BR para as frases dos status ("1 lead", "2 leads"). */
export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Frase com no máximo `max` caracteres, sem cortar no meio da palavra. */
export function clip(text: string, max = 120) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[.,;:]$/, "")}…`;
}
