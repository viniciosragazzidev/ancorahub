/**
 * Personal data never leaves to a model as is (LGPD): phones, e-mails and CPFs
 * are masked, and full names can be shortened to the first name.
 */
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const PHONE = /(?<!\d)(?:\+?55\s?)?(?:\(?\d{2}\)?[\s-]?)?9?\d{4}[\s-]?\d{4}\b/g;

export function maskPersonalData(text: string) {
  return text.replace(EMAIL, "[e-mail]").replace(CPF, "[cpf]").replace(PHONE, "[telefone]");
}

/** "Maria Souza Lima" -> "Maria S." (enough for the model, not enough to identify). */
export function shortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]} ${parts[parts.length - 1]![0]?.toUpperCase()}.`;
}
