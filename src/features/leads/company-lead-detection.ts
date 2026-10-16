/**
 * Lead que é empresa (Vinicios, 16/10): quem fala em CNPJ, MEI, PME, plano
 * empresarial ou "minha empresa", no formulário do anúncio ou na conversa com a
 * IA, vai para a fila PME mesmo tendo chegado pela fila PF ou Premium.
 * Negação logo antes do termo ("não tenho CNPJ", "não é empresarial") não conta.
 */

export function normalizeCompanyText(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const NEGATION_BEFORE = /\b(?:nao|sem|nem|nunca|n)\s+(?:\S+\s+){0,2}$/;

const COMPANY_TERMS = [
  /\bcnpj\b/g,
  /\bmei\b/g,
  /\bpme\b/g,
  /\bpj\b/g,
  /\bempresarial\b/g,
  /\bpessoa juridica\b/g,
  /\b(?:minha|nossa)\s+empresa\b/g,
  /\b(?:para|pra|pela)\s+(?:a\s+)?empresa\b/g,
  /\b(?:tenho|possuo|temos)\s+(?:uma\s+)?empresa\b/g,
  /\bsou\s+(?:empresari[oa]|mei|dono da empresa|dona da empresa)\b/g,
  /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
];

/** O trecho que mostra que o lead é empresa, ou null. */
export function companyEvidence(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = normalizeCompanyText(text);
  for (const pattern of COMPANY_TERMS) {
    pattern.lastIndex = 0;
    for (const match of normalized.matchAll(pattern)) {
      const before = normalized.slice(Math.max(0, match.index - 30), match.index);
      if (NEGATION_BEFORE.test(before)) continue;
      return match[0];
    }
  }
  return null;
}

const COMPANY_QUESTION = /cnpj|empresa|\bmei\b|\bpj\b|\bpme\b|empresarial|juridica/;
const AFFIRMATIVE_ANSWER = /^(?:sim|s|yes|tenho|possuo|temos|tem|claro|mei|me|epp|ltda|eireli|slu|ei|sa)\b/;
const NEGATIVE_ANSWER = /^(?:nao|n|no|nenhum|nenhuma)\b/;
const COMPANY_ANSWER = /^(?:empresa|empresarial|plano empresarial|pj|pme|mei|pessoa juridica|cnpj)$/;

/**
 * Resposta do formulário do anúncio, no formato "Pergunta: resposta". Pergunta
 * sobre empresa/CNPJ com resposta afirmativa (ou o tipo do CNPJ) conta; com
 * "não", não conta. Fora isso, vale o que a resposta diz.
 */
export function formAnswerCompanyEvidence(entry: string): string | null {
  const separator = entry.indexOf(":");
  const question = separator >= 0 ? normalizeCompanyText(entry.slice(0, separator)) : "";
  const answer = normalizeCompanyText(separator >= 0 ? entry.slice(separator + 1) : entry);
  if (!answer || NEGATIVE_ANSWER.test(answer)) return null;
  if (COMPANY_ANSWER.test(answer)) return entry.trim();
  if (question && COMPANY_QUESTION.test(question) && AFFIRMATIVE_ANSWER.test(answer)) return entry.trim();
  return companyEvidence(answer) ? entry.trim() : null;
}

export function formAnswersCompanyEvidence(answers: readonly string[] | null | undefined): string | null {
  for (const entry of answers ?? []) {
    const evidence = formAnswerCompanyEvidence(entry);
    if (evidence) return evidence;
  }
  return null;
}

/** tipo do lead que já indica empresa. */
export function isCompanyLeadType(tipo: string | null | undefined) {
  return tipo === "PJ" || tipo === "PME";
}
