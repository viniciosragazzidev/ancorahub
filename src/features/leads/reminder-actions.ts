"use server";

import "server-only";

import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { criarLembreteDoLead } from "./lembrete-servico";

export type ReminderState = { success?: boolean; error?: string };

const reminderInput = z.object({
  leadId: z.string().min(1),
  /** Preset key or an ISO date string */
  when: z.string().min(1),
  /** Rescheduling: the open return this one replaces (closed in the same transaction). */
  replaceTaskId: z.string().uuid().optional(),
});

export async function quickReminderAction(
  _previous: ReminderState,
  formData: FormData,
): Promise<ReminderState> {
  const parsed = reminderInput.safeParse({
    leadId: formData.get("leadId"),
    when: formData.get("when"),
    replaceTaskId: formData.get("replaceTaskId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };

  try {
    await criarLembreteDoLead(await getRequiredTenantContext(), parsed.data);
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Nao foi possivel criar o lembrete.",
    };
  }
}
