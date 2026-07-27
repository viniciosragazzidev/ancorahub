import { z } from "zod";

export const leadWebhookPayloadSchema = z
  .object({
    externalId: z
      .string()
      .trim()
      .min(1)
      .max(191)
      .optional(),

    name: z
      .string()
      .trim()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(160, "O nome deve ter no máximo 160 caracteres."),

    phone: z
      .string()
      .trim()
      .min(8, "Telefone deve ter pelo menos 8 caracteres.")
      .max(30, "Telefone deve ter no máximo 30 caracteres.")
      .refine(
        (val) =>
          val.replace(/[\s\-\(\)\.]/g, "").replace(/\D/g, "").length >= 10,
        "Telefone deve conter pelo menos 10 dígitos.",
      ),

    email: z
      .string()
      .trim()
      .email("Informe um e-mail válido.")
      .max(254)
      .optional()
      .or(z.literal("")),

    planInterest: z
      .string()
      .trim()
      .max(160)
      .optional(),

    source: z
      .string()
      .trim()
      .min(1, "A origem do lead é obrigatória.")
      .max(100, "A origem deve ter no máximo 100 caracteres."),

    branchExternalId: z
      .string()
      .trim()
      .max(191)
      .optional(),

    metadata: z
      .record(
        z.string(),
        z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.null(),
        ]),
      )
      .optional(),
  })
  .strict();
