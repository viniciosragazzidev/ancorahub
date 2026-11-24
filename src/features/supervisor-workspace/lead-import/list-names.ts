/**
 * Nomes das listas de importação (24/11/2026, DEC-191). Funções puras: a tela sugere e o servidor decide.
 * Padrão "Lista 24/11" com a data do dia em Brasília; se o nome já existe entre as listas do supervisor, ganha
 * " (2)", " (3)"... Vale também para o nome que o supervisor digita.
 */
export const LIST_NAME_MAX = 60;

/** Todas as listas juntas, na vista de contatos. */
export const ALL_LISTS = "todas";

/** Endereço das pastas (null), de uma lista ou de todos os contatos (ALL_LISTS) na vista "Lista importada". */
export function teamListHref(listId: string | null) {
  return listId ? `/leads?vista=lista&lista=${encodeURIComponent(listId)}` : "/leads?vista=lista";
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

export function defaultListName(now: Date) {
  return `Lista ${dayMonth.format(now)}`;
}

/** Espaços juntos, sem travessão nem quebra de linha, até LIST_NAME_MAX. Vazio devolve "". */
export function cleanListName(raw: string | null | undefined) {
  return (raw ?? "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().slice(0, LIST_NAME_MAX).trim();
}

/** "Lista 24/11" vira "Lista 24/11 (2)" quando já existe; compara sem maiúsculas e sem o sufixo. */
export function uniqueListName(base: string, existing: string[]) {
  const key = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
  const taken = new Set(existing.map(key));
  if (!taken.has(key(base))) return base;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, LIST_NAME_MAX - suffix.length).trim()}${suffix}`;
    if (!taken.has(key(candidate))) return candidate;
  }
  return base;
}
