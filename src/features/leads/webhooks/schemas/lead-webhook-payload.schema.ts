import { z } from "zod";

import { LEAD_WITHOUT_NAME } from "./lp-form-payload.schema";

export const leadWebhookPayloadSchema = z
  .object({
    externalId: z
      .string()
      .trim()
      .min(1)
      .max(191)
      .optional(),

    // A lead with a phone always gets in (22/10: a Meta lead named "h" was rejected and lost).
    name: z.preprocess(
      (value) => {
        const name = typeof value === "string" ? value.trim() : "";
        return name.length >= 2 ? name.slice(0, 160) : LEAD_WITHOUT_NAME;
      },
      z.string(),
    ),

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
