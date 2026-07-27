import { z } from "zod";

export const goalInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "O nome da meta é obrigatório.")
      .max(120, "O nome deve ter no máximo 120 caracteres."),
    scope: z.enum(["broker", "team", "branch", "tenant"], {
      message: "Selecione o escopo da meta.",
    }),
    scopeId: z.string().trim().optional().nullable(),
    targetType: z.enum(["sales_count", "revenue", "conversion_rate", "leads_contacted"], {
      message: "Selecione o tipo de meta.",
    }),
    targetValue: z
      .number({ message: "O valor da meta é obrigatório." })
      .positive("O valor deve ser maior que zero.")
      .max(999999999, "Valor muito alto."),
    period: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}$/, "Período inválido. Use o formato YYYY-MM (ex.: 2026-08)."),
    startDate: z
      .string()
      .trim()
      .min(1, "Data de início é obrigatória."),
    endDate: z
      .string()
      .trim()
      .min(1, "Data de fim é obrigatória."),
    active: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.scope === "broker" || data.scope === "team" || data.scope === "branch") {
        return !!data.scopeId;
      }
      return true;
    },
    {
      message: "Selecione o destinatário da meta.",
      path: ["scopeId"],
    },
  );

export type GoalInput = z.infer<typeof goalInputSchema>;

export type GoalActionState = {
  success?: boolean;
  error?: string;
};
