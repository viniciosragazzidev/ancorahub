import { z } from "zod";

/**
 * Schema for landing page form submissions.
 * Accepts Portuguese field names (nome, telefone, plano_interesse)
 * mapped to internal names. Also handles the honeypot field.
 */
export const lpFormPayloadSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(160, "O nome deve ter no máximo 160 caracteres."),

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
