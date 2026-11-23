import { z } from "zod";

import { CNPJ_QUALIFIERS, CPF_QUALIFIERS, parseBrazilianMobile, parseName, parsePlace, type PublicFormSubmission } from "./form-flow";

/**
 * O envio do /formulario conferido no servidor com as mesmas regras da conversa: nome, bairro e cidade,
 * celular brasileiro com DDD e as opções que existem em cada ramo. Nada além do que a tela manda.
 */
export const publicFormSubmissionSchema = z.object({
  kind: z.enum(["cpf", "cnpj"]),
  name: z.string().max(200),
  people: z.string().trim().min(2).max(80),
  ages: z.array(z.number().int().min(0).max(110)).max(15).nullable(),
  lives: z.number().int().min(1).max(5000).nullable(),
  neighborhood: z.string().max(200),
  city: z.string().max(200),
  currentPlan: z.enum(["tem_plano", "sem_plano"]),
  qualifier: z.string().max(40),
  phone: z.string().max(40),
  website: z.string().max(500).optional().default(""),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
}).strict();

export type ParsedSubmission = { ok: true; data: PublicFormSubmission } | { ok: false; error: string };

export function parsePublicFormSubmission(payload: unknown): ParsedSubmission {
  const parsed = publicFormSubmissionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Algumas respostas chegaram incompletas. Recarregue a página e responda de novo." };
  const data = parsed.data;
  const name = parseName(data.name);
  if ("error" in name) return { ok: false, error: name.error };
  const place = parsePlace(`${data.neighborhood}, ${data.city}`);
  if ("error" in place) return { ok: false, error: place.error };
  const phone = parseBrazilianMobile(data.phone);
  if ("error" in phone) return { ok: false, error: phone.error };
  const qualifiers = data.kind === "cnpj" ? CNPJ_QUALIFIERS : CPF_QUALIFIERS;
  if (!qualifiers.some((option) => option.id === data.qualifier)) return { ok: false, error: "Algumas respostas chegaram incompletas. Recarregue a página e responda de novo." };
  return {
    ok: true,
    data: {
      ...data,
      name: name.name,
      people: data.people.replace(/[<>{}[\]\\]/g, ""),
      neighborhood: data.neighborhood.trim().replace(/\s+/g, " ").replace(/[<>{}[\]\\]/g, ""),
      city: data.city.trim().replace(/\s+/g, " ").replace(/[<>{}[\]\\]/g, ""),
      phone: phone.phone,
      website: data.website ?? "",
    },
  };
}
