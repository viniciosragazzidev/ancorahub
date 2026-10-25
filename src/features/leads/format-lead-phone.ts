/**
 * Telefone legível e alinhado: com DDI 55, "(55) 21 99883-6148"; só com DDD, "(21) 99883-6148"; fora desses formatos,
 * como veio.
 */
export function formatLeadPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const local = (ddd: string, number: string) => `${ddd} ${number.slice(0, number.length - 4)}-${number.slice(-4)}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return `(55) ${local(digits.slice(2, 4), digits.slice(4))}`;
  if (digits.length === 10 || digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
  return raw;
}
