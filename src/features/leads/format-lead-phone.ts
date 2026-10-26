/**
 * Telefone legível e alinhado, no padrão brasileiro: "(21) 99883-6148". O DDI 55 sai (todos os leads são do Brasil);
 * fora desses formatos, como veio.
 */
export function formatLeadPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  if (national.length === 10 || national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, national.length - 4)}-${national.slice(-4)}`;
  return raw;
}
