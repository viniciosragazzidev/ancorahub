"use server";

import "server-only";

import { z } from "zod";
import { executeLeadAssignedNotification } from "./lead-assigned-notification";

const actionSchema = z.object({
  leadId: z.string().uuid(),
  channels: z.array(z.enum(["push", "whatsapp"])).min(1).max(2),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export type TriggerPluginResult = {
  success: boolean;
  duplicate?: boolean;
  channels?: string[];
  warnings?: string[];
  error?: string;
};

export async function triggerLeadAssignedNotificationAction(input: unknown): Promise<TriggerPluginResult> {
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const result = await executeLeadAssignedNotification(parsed.data);
    return { success: true, duplicate: result.duplicate, channels: result.channels, warnings: result.warnings };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível executar o plugin." };
  }
}

