import { z } from "zod";

/** Name used when the form brings none or a single letter. */
export const LEAD_WITHOUT_NAME = "Lead sem nome";

/**
 * Schema for landing page form submissions.
 * Accepts Portuguese field names (nome, telefone, plano_interesse)
 * mapped to internal names. Also handles the honeypot field.
 */
export const lpFormPayloadSchema = z
  .object({
    // A lead with a phone always gets in (22/10: a Meta lead named "h" was rejected and lost).
    nome: z.preprocess(
      (value) => {
        const name = typeof value === "string" ? value.trim() : "";
        return name.length >= 2 ? name.slice(0, 160) : LEAD_WITHOUT_NAME;
      },
      z.string(),
    ),

    telefone: z
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

    plano_interesse: z
      .string()
      .trim()
      .max(160)
      .optional(),

    /** Honeypot — invisible to humans, bots fill it */
    website: z.string().optional().default(""),

    /** Timestamp injected by the embed script */
    receivedAt: z.string().optional(),
  })
  .strict();
