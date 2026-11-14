/**
 * CPF e CNPJ na entrada: aceita com ou sem pontuação (e espaços, barras, traços colados de PDF), confere o dígito
 * verificador e formata. Funções puras, servem no cliente e no servidor.
 */

export type MotivoDocumentoInvalido = "vazio" | "tamanho" | "repetido" | "digito";

export type DocumentoLido =
  | { ok: true; digitos: string; exibicao: string }
  | { ok: false; motivo: MotivoDocumentoInvalido; mensagem: string };

const so = (valor: string) => valor.replace(/\D/g, "");

function digitoCpf(base: string, peso: number) {
  let soma = 0;
  for (const digito of base) soma += Number(digito) * peso--;
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

function digitoCnpj(base: string) {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma = 0;
  for (let i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i]!;
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CPF válido (11 dígitos, não repetido, dígitos verificadores corretos). Aceita com ou sem pontuação. */
export function validarCpf(entrada: string | null | undefined): boolean {
  const d = so(entrada ?? "");
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  return digitoCpf(d.slice(0, 9), 10) === Number(d[9]) && digitoCpf(d.slice(0, 10), 11) === Number(d[10]);
}

/** CNPJ válido (14 dígitos, não repetido, dígitos verificadores corretos). Aceita com ou sem pontuação. */
export function validarCnpj(entrada: string | null | undefined): boolean {
  const d = so(entrada ?? "");
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  return digitoCnpj(d.slice(0, 12)) === Number(d[12]) && digitoCnpj(d.slice(0, 13)) === Number(d[13]);
}

/** "000.000.000-00" (progressivo: serve para máscara enquanto digita). */
export function formatarCpf(entrada: string): string {
  const d = so(entrada).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "00.000.000/0000-00" (progressivo: serve para máscara enquanto digita). */
export function formatarCnpj(entrada: string): string {
  const d = so(entrada).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function ler(entrada: string | null | undefined, tamanho: 11 | 14): DocumentoLido {
  const nome = tamanho === 11 ? "CPF" : "CNPJ";
  const d = so(entrada ?? "");
  if (!d) return { ok: false, motivo: "vazio", mensagem: `Informe o ${nome}.` };
  if (d.length !== tamanho) return { ok: false, motivo: "tamanho", mensagem: `O ${nome} tem ${tamanho} números.` };
  if (new RegExp(`^(\\d)\\1{${tamanho - 1}}$`).test(d)) return { ok: false, motivo: "repetido", mensagem: `${nome} inválido.` };
  const valido = tamanho === 11 ? validarCpf(d) : validarCnpj(d);
  if (!valido) return { ok: false, motivo: "digito", mensagem: `${nome} inválido. Confira os números.` };
  return { ok: true, digitos: d, exibicao: tamanho === 11 ? formatarCpf(d) : formatarCnpj(d) };
}

/** Lê um CPF digitado ou colado de qualquer jeito. */
export function lerCpf(entrada: string | null | undefined): DocumentoLido {
  return ler(entrada, 11);
}

/** Lê um CNPJ digitado ou colado de qualquer jeito. */
export function lerCnpj(entrada: string | null | undefined): DocumentoLido {
  return ler(entrada, 14);
}
