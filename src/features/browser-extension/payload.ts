import { z } from "zod";
const named = z.object({ id: z.string(), name: z.string() }).strict();
export const extensionTemperatureSchema = z.enum(["quente", "morno", "frio", "sem-dados"]);
/** Presentation of the persisted qualification; never infers a new temperature. */
export function extensionTemperature(status: string | null | undefined) {
  return status === "hot" ? "quente" as const : status === "warm" ? "morno" as const
    : status === "cold" ? "frio" as const : "sem-dados" as const;
}
/** Fail closed, including nested fields. Expanding this contract requires an explicit review. */
export const extensionLeadPayloadSchema = z.object({
  id: z.string(), version: z.number().int(), name: z.string(), phoneMasked: z.string(),
  currentStatus: z.object({ id: z.string(), label: z.string() }).strict(),
  origin: z.string(), sourceCampaign: z.string().optional(), unit: named.nullable(), assignedUser: named.nullable(),
  nextAction: z.object({ id: z.string(), title: z.string(), dueAt: z.string().nullable(), status: z.literal("PENDING") }).strict().nullable(),
  qualification: z.object({ completed: z.array(z.string()), missing: z.array(z.string()) }).strict(),
  allowedActions: z.array(z.enum(["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"])),
  etapa: z.string(), unidade: z.string().optional(), corretor: z.string().optional(),
  proximoPasso: z.object({ titulo: z.string(), prazo: z.string().nullable() }).strict().nullable(),
  temperatura: extensionTemperatureSchema,
  fila: z.string().optional(), plantao: z.string().optional(), chegouEm: z.string().datetime().nullable(),
  plano: z.string().optional(), vidas: z.number().int().positive().optional(), valorMensal: z.number().finite().nonnegative().optional(),
  historico: z.array(z.object({ tipo: z.string(), data: z.string().datetime() }).strict()).max(5),
}).strict();
