"use server";

import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { saveUserNotificationPreferences } from "./preferences";
import { normalizeNotificationPreferences } from "./preferences-core";

const channelSchema = z.object({ push: z.boolean().optional(), whatsapp: z.boolean().optional() });
const inputSchema = z.object({
  channels: z.record(z.string(), channelSchema),
  pushPrivacy: z.boolean(),
});

/** Grava as preferências do próprio usuário (nunca de outra pessoa). */
export async function saveNotificationPreferencesAction(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Preferências inválidas. Recarregue a página." };
  const context = await getRequiredTenantContext();
  const prefs = normalizeNotificationPreferences(parsed.data);
  const result = await saveUserNotificationPreferences(context.userId, prefs);
  if (!result.saved) {
    return { success: false as const, error: "As preferências ainda não podem ser salvas: falta atualizar o banco. Fale com o suporte." };
  }
  return { success: true as const, preferences: prefs };
}
