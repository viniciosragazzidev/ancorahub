import { z } from "zod";

export const seasonInputSchema = z.object({
  name: z.string().trim().min(3, "Informe um nome para a temporada.").max(120),
  startsAt: z.string().date("Informe a data de início."),
  endsAt: z.string().date("Informe uma data de término.").optional().or(z.literal("")),
  activate: z.boolean().default(false),
}).refine((value) => !value.endsAt || value.endsAt >= value.startsAt, {
  message: "O término não pode ser anterior ao início.",
  path: ["endsAt"],
});

export const resetSeasonSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome da nova temporada.").max(120),
  reason: z.string().trim().max(280).optional(),
});

export const awardInputSchema = z.object({
  seasonId: z.string().uuid("Temporada inválida."),
  rankPosition: z.coerce.number().int().min(1).max(100),
  title: z.string().trim().min(2, "Informe o nome da premiação.").max(120),
  description: z.string().trim().max(500).optional(),
  rewardType: z.enum(["recognition", "bonus", "gift", "other"]),
  rewardValue: z.string().trim().max(160).optional(),
});

export type PerformanceActionState = { success?: string; error?: string };
