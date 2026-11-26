/**
 * CNPJ de empresa (lead PJ/PME): só dígitos, dígitos verificadores, máscara e a busca da tela /empresas.
 * Funções puras, usadas no servidor (antes de consultar a BrasilAPI) e no cliente (busca e máscara).
 */

/** Só os dígitos do texto digitado ("12.345.678/0001-95" vira "12345678000195"). */
export function cnpjDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function checkDigit(base: string) {
  const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** CNPJ válido: 14 dígitos, não repetidos, com os dois dígitos verificadores certos. */
export function isValidCnpj(value: string | null | undefined) {
  const digits = cnpjDigits(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const first = checkDigit(digits.slice(0, 12));
  if (first !== Number(digits[12])) return false;
  return checkDigit(digits.slice(0, 13)) === Number(digits[13]);
}

/** Os 14 dígitos de um CNPJ válido, ou null. É o único dado que vai para a consulta externa. */
export function normalizeValidCnpj(value: string | null | undefined) {
  return isValidCnpj(value) ? cnpjDigits(value) : null;
}

/** Máscara 00.000.000/0000-00. Texto que não tem 14 dígitos volta como veio, sem espaços nas pontas. */
export function formatCnpj(value: string | null | undefined) {
  const digits = cnpjDigits(value);
  if (digits.length !== 14) return (value ?? "").trim();
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Motivo de um CNPJ recusado antes da consulta, em frase curta. Null quando está certo. */
export function cnpjInputProblem(value: string | null | undefined) {
  const digits = cnpjDigits(value);
  if (!digits) return "Digite o CNPJ da empresa.";
  if (digits.length !== 14) return "O CNPJ tem 14 dígitos. Confira o número.";
  if (!isValidCnpj(digits)) return "CNPJ inválido: os dígitos verificadores não conferem.";
  return null;
}

function fold(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
}

/** Busca da tela /empresas: nome ou razão social (sem acento) ou CNPJ com ou sem pontuação. */
export function matchesCompanyQuery(company: { name: string; legalName?: string | null; cnpj: string | null }, query: string) {
  const text = fold(query);
  if (!text) return true;
  if (fold(company.name).includes(text) || fold(company.legalName ?? "").includes(text)) return true;
  const digits = cnpjDigits(query);
  // Só compara CNPJ quando a busca é feita de números e pontuação ("12.345", "12345678/0001").
  if (digits.length >= 2 && /^[\d.\-/\s]+$/.test(query.trim())) return cnpjDigits(company.cnpj).includes(digits);
  return false;
}
