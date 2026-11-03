import { z } from "zod";

export const extensionVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/, "Versão inválida.");
export const phoneSchema = z.string().trim().min(8).max(32);
export const extensionIdSchema = z.string().regex(/^[a-p]{32}$/, "ID da extensão inválido.");
export const extensionCodeBindingSchema = z.object({ extensionId: extensionIdSchema, deviceId: z.string().trim().min(8).max(128) }).strict();
export type ExtensionCodeBinding = z.infer<typeof extensionCodeBindingSchema>;
export const extensionDeviceSchema = z.object({
  extensionId: extensionIdSchema.optional(),
  code: z.string().trim().min(32).max(256),
  deviceId: z.string().trim().min(8).max(128),
  extensionVersion: extensionVersionSchema,
});
export type ExtensionDeviceInput = z.infer<typeof extensionDeviceSchema>;
export const resolveLeadSchema = z.object({ phone: phoneSchema });
export const statusPatchSchema = z.object({
  statusId: z.string().trim().min(1).max(64),
  expectedVersion: z.number().int().positive(),
  /** Obrigatório quando a etapa é "lost"; a lista válida é MOTIVOS_PERDA (validada no serviço). */
  motivoPerda: z.string().trim().max(120).optional(),
});
/** Nota interna do corretor no lead. Nunca volta para a extensão (a gaveta só escreve). */
export const notaSchema = z.object({
  conteudo: z.string().trim().min(1, "Escreva a nota.").max(1000),
  expectedVersion: z.number().int().positive(),
});
/** Tarefa rápida do corretor: título e prazo opcional. Responsável é sempre o próprio corretor. */
export const tarefaSchema = z.object({
  title: z.string().trim().min(3, "Informe um título com ao menos 3 caracteres.").max(160),
  dueAt: z.string().datetime().optional(),
  expectedVersion: z.number().int().positive(),
});
/** Lembrete de retorno: preset ("today", "tomorrow", "in_2_days", "in_3_days") ou data ISO. */
export const lembreteSchema = z.object({
  when: z.string().trim().min(1).max(40),
  replaceTaskId: z.string().uuid().optional(),
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
  /** Obrigatório quando statusId é "lost"; a lista válida é validada no serviço de status. */
  motivoPerda: z.string().trim().max(120).optional(),
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
