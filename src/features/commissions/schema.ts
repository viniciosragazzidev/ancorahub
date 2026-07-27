import { z } from "zod";

export const commissionRuleInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "O nome da regra é obrigatório.")
      .max(100, "O nome deve ter no máximo 100 caracteres."),
    type: z.enum(["unica", "escalonada"], {
      message: "Selecione o tipo de comissão.",
    }),
    percentages: z
      .array(z.number().min(0, "Percentual não pode ser negativo.").max(1000, "Percentual muito alto."))
      .min(1, "Adicione pelo menos uma parcela.")
      .max(60, "Máximo de 60 parcelas."),
    appliesToAll: z.boolean().default(false),
    carrierId: z.string().trim().optional().nullable(),
    planId: z.string().trim().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.appliesToAll) return true;
      // If not appliesToAll, either carrierId or planId must be set
      return data.carrierId || data.planId;
    },
    {
      message: "Selecione uma operadora/plano ou marque 'Aplicar a todos'.",
      path: ["carrierId"],
    },
  )
  .refine(
    (data) => {
      if (data.type === "unica") return data.percentages.length === 1;
      return true;
    },
    {
      message: "Comissão única deve ter exatamente 1 parcela.",
      path: ["percentages"],
    },
  );

export type CommissionRuleInput = z.infer<typeof commissionRuleInputSchema>;

export type CommissionActionState = {
  success?: boolean;
  error?: string;
};
