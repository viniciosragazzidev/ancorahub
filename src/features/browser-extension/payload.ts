import { z } from "zod";
const named = z.object({ id: z.string(), name: z.string() }).strict();
/** Fail closed, including nested fields. Expanding this contract requires an explicit review. */
export const extensionLeadPayloadSchema = z.object({
  id: z.string(), version: z.number().int(), name: z.string(), phoneMasked: z.string(),
  currentStatus: z.object({ id: z.string(), label: z.string() }).strict(),
  origin: z.string(), sourceCampaign: z.string().optional(), unit: named.nullable(), assignedUser: named.nullable(),
  nextAction: z.object({ id: z.string(), title: z.string(), dueAt: z.string().nullable(), status: z.literal("PENDING") }).strict().nullable(),
  qualification: z.object({ completed: z.array(z.string()), missing: z.array(z.string()) }).strict(),
  allowedActions: z.array(z.enum(["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"])),
}).strict();
