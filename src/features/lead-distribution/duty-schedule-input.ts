import { z } from "zod";
import { zonedMidnight } from "./monthly-duty-plan";

const DUTY_TIME_ZONE = "America/Sao_Paulo";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

// A date input ("2026-11-21") means a local calendar day, not UTC midnight
// (which is 21:00 of the day before in São Paulo and shrank every re-save).
// "A partir de" starts at local midnight; "até" includes the whole day.
const startOfLocalDay = (value: unknown) => (typeof value === "string" && DATE_ONLY.test(value) ? zonedMidnight(value, DUTY_TIME_ZONE) : value);
const endOfLocalDay = (value: unknown) => (typeof value === "string" && DATE_ONLY.test(value) ? zonedMidnight(nextDateKey(value), DUTY_TIME_ZONE) : value);

// Plain object (no refinements) so create/update schemas can omit/extend it;
// Zod 4 refuses `.omit()` on a refined schema at module load.
const dutyScheduleFields = z.object({
  branchId: z.preprocess((value) => value === "" || value === undefined ? null : value, z.string().uuid().nullable().optional()),
  queueId: z.preprocess((value) => value === "" || value === undefined ? null : value, z.string().uuid().nullable().optional()),
  name: z.string().trim().min(2).max(100),
  typeName: z.preprocess((value) => value === "" || value === undefined ? null : value, z.string().trim().min(2).max(60).nullable().optional()),
  /** Saved plantão type (DEC-138). Wins over the legacy free-text typeName. */
  typeId: z.preprocess((value) => value === "" || value === undefined ? null : value, z.string().uuid().nullable().optional()),
  attendanceMode: z.enum(["online", "presencial"]).default("online"),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: z.string(),
  endsAt: z.string(),
  minimumBrokers: z.coerce.number().int().min(1).max(99),
  maximumBrokers: z.preprocess((value) => value === "" || value === undefined ? null : value, z.coerce.number().int().min(1).max(99).nullable().optional()),
  /** Leads each broker may receive in one occurrence of this plantão; empty = no cap. */
  maxLeadsPerBroker: z.preprocess((value) => value === "" || value === undefined ? null : value, z.coerce.number().int().min(1).max(500).nullable().optional()),
  /** Morning/afternoon split time ("13:30"); empty = the plantão is one shift. */
  shiftSplitAt: z.preprocess((value) => value === "" || value === undefined ? null : value, z.string().regex(/^\d{2}:\d{2}$/, "Horário de divisão inválido.").nullable().optional()),
  validFrom: z.preprocess(startOfLocalDay, z.coerce.date()),
  validUntil: z.preprocess(endOfLocalDay, z.coerce.date().optional()),
  webhookCredentialId: z.string().uuid().optional().nullable(),
});

const maximumAtLeastMinimum = (value: { minimumBrokers: number; maximumBrokers?: number | null }) =>
  value.maximumBrokers == null || value.maximumBrokers >= value.minimumBrokers;
const maximumAtLeastMinimumIssue = { path: ["maximumBrokers"], message: "O máximo deve ser igual ou maior que o mínimo." };

export const dutyScheduleInput = dutyScheduleFields.refine(maximumAtLeastMinimum, maximumAtLeastMinimumIssue);

const dayOfWeekInput = z.coerce.number().int().min(0).max(6);
const legacyUnitAssignmentsInput = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}, z.array(z.object({ branchId: z.string().uuid(), queueId: z.string().uuid() })).min(1).max(50).refine(
  (assignments) => new Set(assignments.map((assignment) => assignment.branchId)).size === assignments.length,
  "Cada unidade pode aparecer apenas uma vez.",
)).optional();
const daysOfWeekInput = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, z.array(dayOfWeekInput).min(1, "Selecione ao menos um dia da semana.").max(7).refine(
  (days) => new Set(days).size === days.length,
  "Cada dia da semana pode ser selecionado apenas uma vez.",
));

const createDutyScheduleInput = dutyScheduleFields.omit({ branchId: true, queueId: true, dayOfWeek: true }).extend({
  // Keep accepting the legacy single-day field while old forms are still open.
  dayOfWeek: dayOfWeekInput.optional(),
  daysOfWeek: daysOfWeekInput.optional(),
  // Accepted only for backwards compatibility with already-open forms. New
  // plantões are always created globally and do not use this field.
  unitAssignments: legacyUnitAssignmentsInput,
  // Not stored on the row (new plantões stay global — branch_id/queue_id null).
  // Only used to scope the same-time conflict check: two global plantões at
  // the same day/time are fine as long as they end up serving different
  // queues, so the check needs to know which queue this one is headed for.
  responsibleQueueId: z.preprocess((value) => value === "" || value === undefined ? null : value, z.string().uuid().nullable().optional()),
  /** Queues that receive the new plantão(s): several are allowed. */
  responsibleQueueIds: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  }, z.array(z.string().uuid()).max(30).optional()),
  /** "Possui turnos": each date becomes two plantões, start–13:30 and 13:30–end. */
  splitIntoShifts: z.preprocess((value) => value === "true" || value === true, z.boolean()).optional(),
  // "Datas" mode: each date becomes a plantão valid only on that day.
  dates: z.preprocess((value) => {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  }, z.array(z.string().regex(DATE_ONLY)).max(93, "Escolha no máximo 93 datas (cerca de 3 meses) por vez.").refine((dates) => new Set(dates).size === dates.length, "Cada data pode aparecer apenas uma vez.")).optional(),
}).superRefine((value, ctx) => {
  if (!value.dates?.length && !value.daysOfWeek?.length && value.dayOfWeek === undefined) {
    ctx.addIssue({ code: "custom", path: ["daysOfWeek"], message: "Selecione ao menos um dia da semana." });
  }
  if (!maximumAtLeastMinimum(value)) ctx.addIssue({ code: "custom", ...maximumAtLeastMinimumIssue });
}).transform((value) => ({
  ...value,
  daysOfWeek: value.daysOfWeek ?? (value.dayOfWeek === undefined ? [] : [value.dayOfWeek]),
}));

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

/** Omit this property for legacy callers so editing a schedule keeps its saved attendance mode. */
export function getAttendanceModeUpdate(formData: Pick<FormData, "has">, attendanceMode: "online" | "presencial") {
  return formData.has("attendanceMode") ? { attendanceMode } : {};
}

/** The duplicate path requires attendanceMode in its source projection and carries it into the clone. */
export function buildDuplicateDutyScheduleValues<T extends { name: string; attendanceMode: string }>(schedule: T, cloneId: string, userId: string, now: Date) {
  return {
    ...schedule,
    id: cloneId,
    name: `${schedule.name} (cópia)`,
    status: "inactive" as const,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseCreateDutyScheduleInput(formData: FormData) {
  return createDutyScheduleInput.safeParse(cleanFormData(formData));
}
