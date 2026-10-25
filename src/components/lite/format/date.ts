/**
 * Datas do visual Lite: sempre "pt-BR" e fuso de São Paulo. Sem o fuso, o servidor (UTC) e o navegador (BRT)
 * formatam dias diferentes perto da meia-noite e a hidratação quebra. Use estas funções em toda página Lite.
 */
export const LITE_TIME_ZONE = "America/Sao_Paulo";

const cache = new Map<string, Intl.DateTimeFormat>();

/** Formatador com o fuso fixo; o mesmo conjunto de opções reaproveita a instância. */
export function liteDateFormatter(options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: LITE_TIME_ZONE });
    cache.set(key, formatter);
  }
  return formatter;
}

/** Data (dd/mm/aaaa por padrão). Valor vazio ou inválido vira `fallback`. */
export function formatLiteDate(value: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions, fallback = "Sem data"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return fallback;
  return liteDateFormatter(options).format(date);
}
