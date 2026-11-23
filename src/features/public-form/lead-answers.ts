import { PUBLIC_FORM_CHANNEL_ID } from "./channel";

/**
 * As respostas do /formulario para a ficha do lead: o que foi gravado em `formData` (cidade, bairro, idades
 * ou vidas) e em `sourceMetadata.formAnswers` ("Pergunta: resposta"), na ordem em que a pessoa respondeu.
 * Null quando o lead não veio do formulário.
 */
export type PublicFormAnswerRow = { label: string; value: string };

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});

export function readPublicFormAnswers(sourceChannel: string | null | undefined, sourceMetadata: unknown, formData: unknown): PublicFormAnswerRow[] | null {
  if (sourceChannel !== PUBLIC_FORM_CHANNEL_ID) return null;
  const form = record(formData);
  const answers = new Map<string, string>();
  for (const entry of Array.isArray(record(sourceMetadata).formAnswers) ? record(sourceMetadata).formAnswers as unknown[] : []) {
    const line = text(entry);
    const at = line?.indexOf(": ") ?? -1;
    if (line && at > 0) answers.set(line.slice(0, at), line.slice(at + 2));
  }
  const rows: PublicFormAnswerRow[] = [];
  const push = (label: string, value: string | null | undefined) => { if (value) rows.push({ label, value }); };
  push("Para quem", answers.get("Para quem"));
  push("Idades", text(form.idades));
  push("Vidas", text(form.qtdVidas));
  push("Cidade", text(form.cidade));
  push("Bairro", text(form.bairro));
  push("Plano atual", answers.get("Plano atual"));
  // Perguntas que vierem depois (ou de versões antigas do formulário) aparecem como chegaram.
  for (const [label, value] of answers) if (label !== "Para quem" && label !== "Plano atual") push(label, value);
  return rows;
}
