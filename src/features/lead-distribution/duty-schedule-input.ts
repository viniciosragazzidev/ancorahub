import { z } from "zod";

export const dutyScheduleInput = z.object({
  branchId: z.string().uuid(),
  queueId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: z.string(),
  endsAt: z.string(),
  priority: z.coerce.number().int().min(1).max(999),
  minimumBrokers: z.coerce.number().int().min(1).max(99),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  webhookCredentialId: z.string().uuid().optional().nullable(),
});

const unitAssignmentInput = z.object({
  branchId: z.string().uuid(),
  queueId: z.string().uuid(),
});

const createDutyScheduleInput = dutyScheduleInput.omit({ branchId: true, queueId: true }).extend({
  unitAssignments: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  }, z.array(unitAssignmentInput).min(1).max(50).refine(
    (assignments) => new Set(assignments.map((assignment) => assignment.branchId)).size === assignments.length,
    "Cada unidade pode aparecer apenas uma vez.",
  )),
});

function cleanFormData(formData: FormData) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && value.trim() === "") continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export function parseDutyScheduleInput(formData: FormData) {
  return dutyScheduleInput.safeParse(cleanFormData(formData));
}

export function parseCreateDutyScheduleInput(formData: FormData) {
  return createDutyScheduleInput.safeParse(cleanFormData(formData));
}
