import { z } from "zod";

import { parseBrazilianMobile, parseLocality, parseName, type PublicFormSubmission } from "./form-flow";

/**
 * O envio do /formulario conferido no servidor com as mesmas regras da conversa: nome, cidade, bairro
 * e celular brasileiro com DDD. Nada além do que a tela manda.
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
  phone: z.string().max(40),
  website: z.string().max(500).optional().default(""),
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
}).strict();

export type ParsedSubmission = { ok: true; data: PublicFormSubmission } | { ok: false; error: string };

const INCOMPLETE = "Algumas respostas chegaram incompletas. Recarregue a página e responda de novo.";

export function parsePublicFormSubmission(payload: unknown): ParsedSubmission {
  const parsed = publicFormSubmissionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: INCOMPLETE };
  const data = parsed.data;
  const name = parseName(data.name);
  if ("error" in name) return { ok: false, error: name.error };
  const city = parseLocality(data.city, "cidade");
  if ("error" in city) return { ok: false, error: city.error };
  const neighborhood = parseLocality(data.neighborhood, "bairro");
  if ("error" in neighborhood) return { ok: false, error: neighborhood.error };
  const phone = parseBrazilianMobile(data.phone);
  if ("error" in phone) return { ok: false, error: phone.error };
  return {
    ok: true,
    data: {
      ...data,
      name: name.name,
      people: data.people.replace(/[<>{}[\]\\]/g, ""),
      neighborhood: neighborhood.value,
      city: city.value,
      phone: phone.phone,
      website: data.website ?? "",
    },
  };
}
