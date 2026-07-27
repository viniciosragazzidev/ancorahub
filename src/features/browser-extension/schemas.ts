import { z } from "zod";

export const extensionVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/, "Versão inválida.");
export const phoneSchema = z.string().trim().min(8).max(32);
export const extensionDeviceSchema = z.object({
  code: z.string().trim().min(32).max(256),
  deviceId: z.string().trim().min(8).max(128),
  extensionVersion: extensionVersionSchema,
});
export const resolveLeadSchema = z.object({ phone: phoneSchema });
export const statusPatchSchema = z.object({
  statusId: z.string().trim().min(1).max(64),
  expectedVersion: z.number().int().positive(),
});
export const suggestionSchema = z.object({
  goal: z.enum(["CONTINUE_ATTENDANCE", "ASK_MISSING_FIELD", "HANDLE_OBJECTION", "REQUEST_DATA", "FOLLOW_UP", "SCHEDULE_CALLBACK", "SEND_QUOTE", "CLOSE_POLITELY"]),
  expectedLeadVersion: z.number().int().positive(),
  optionalContext: z.string().trim().max(500).optional().default(""),
});
export const feedbackSchema = z.object({
  outcome: z.enum(["INTERESTED", "NO_RESPONSE", "NOT_INTERESTED", "CALLBACK", "QUALIFIED", "UNQUALIFIED"]),
  nextAction: z.string().trim().max(160).optional(),
  nextActionAt: z.string().datetime().optional(),
  statusId: z.string().trim().max(64).optional(),
  expectedVersion: z.number().int().positive(),
  note: z.string().trim().max(1000).optional(),
});

export type ExtensionSession = {
  userId: string;
  tenantId: string;
  deviceId: string;
  sessionId: string;
  expiresAt: string;
  permissions: string[];
};

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  return `+${digits}`;
}

export function maskPhone(value: string): string {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 8) return "••••";
  return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} 9****-${digits.slice(-4)}`;
}
