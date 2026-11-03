import { z } from "zod";

/** Mensagens da conversa de qualificação (número oficial, IA) mostradas na extensão. Só texto, sem anexo, sem nota interna. */
export const QUALIFICATION_THREAD_LIMIT = 50;

export const extensionQualificationMessageSchema = z.object({
  de: z.enum(["cliente", "qualificacao"]),
  texto: z.string(),
  horario: z.string().datetime(),
}).strict();

export const extensionQualificationThreadSchema = z.object({
  leadId: z.string().uuid(),
  total: z.number().int().nonnegative(),
  mensagens: z.array(extensionQualificationMessageSchema).max(QUALIFICATION_THREAD_LIMIT),
}).strict();

export type ExtensionQualificationThread = z.infer<typeof extensionQualificationThreadSchema>;
