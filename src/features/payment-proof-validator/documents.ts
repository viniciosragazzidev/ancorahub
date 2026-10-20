import { onlyDigits } from "./boleto";

/**
 * Compara um CPF/CNPJ mascarado do comprovante (ex.: "***967437**",
 * "**.*09.127/0001-**") com um documento completo.
 * Retorna null quando o mascarado não mostra nenhum dígito.
 */
export function maskedDocumentMatches(masked: string | null | undefined, full: string | null | undefined) {
  const pattern = (masked ?? "").replace(/[xX•●]/g, "*").replace(/[^\d*]/g, "");
  const fullDigits = onlyDigits(full);
  if (!/\d/.test(pattern) || !fullDigits) return null;

  if (pattern.length === fullDigits.length) {
    return [...pattern].every((char, index) => char === "*" || char === fullDigits[index]);
  }

  // Máscara com tamanho diferente: os trechos visíveis precisam aparecer em ordem.
  let cursor = 0;
  for (const group of pattern.split("*").filter(Boolean)) {
    const found = fullDigits.indexOf(group, cursor);
    if (found === -1) return false;
    cursor = found + group.length;
  }
  return true;
}

export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Operadoras com o CNPJ que aparece como beneficiário do boleto.
 * Confira antes de incluir uma nova: um CNPJ errado aprova comprovante falso.
 */
export const KNOWN_OPERATORS: ReadonlyArray<{ name: string; aliases: string[]; cnpj: string }> = [
  { name: "Amil", aliases: ["amil"], cnpj: "29309127000179" },
];

export function findOperatorByMaskedCnpj(masked: string | null | undefined) {
  return KNOWN_OPERATORS.filter((operator) => maskedDocumentMatches(masked, operator.cnpj) === true);
}

export function operatorNameMatches(operatorName: string | null | undefined, text: string | null | undefined) {
  const haystack = normalizeText(text);
  const name = normalizeText(operatorName);
  if (!haystack || !name) return false;
  const known = KNOWN_OPERATORS.find((operator) => operator.aliases.some((alias) => name.includes(alias)));
  const aliases = known ? known.aliases : [name.split(/\s+/)[0]];
  return aliases.some((alias) => alias.length >= 3 && haystack.includes(alias));
}
