"use server";


import { randomUUID } from "node:crypto";

import { approvePasswordReset, rejectPasswordReset } from "@/features/team/password-recovery";

export type RecoveryActionState = { success?: boolean; error?: string; message?: string; mutationId?: string };

export async function approveResetAction(
  _prev: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  try {
    const requestId = String(formData.get("requestId") ?? "").trim();
    if (!requestId) throw new Error("ID da solicitação não informado.");

    await approvePasswordReset(requestId);
    return { success: true, mutationId: randomUUID(), message: "Solicitação aprovada! O link de recuperação será enviado por WhatsApp." };
  } catch (e) {
    return { success: false, mutationId: randomUUID(), error: e instanceof Error ? e.message : "Erro ao aprovar solicitação." };
  }
}

export async function rejectResetAction(
  _prev: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  try {
    const requestId = String(formData.get("requestId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim() || undefined;

    if (!requestId) throw new Error("ID da solicitação não informado.");

    await rejectPasswordReset(requestId, reason);
    return { success: true, mutationId: randomUUID(), message: reason ? "Solicitação rejeitada com justificativa." : "Solicitação rejeitada." };
  } catch (e) {
    return { success: false, mutationId: randomUUID(), error: e instanceof Error ? e.message : "Erro ao rejeitar solicitação." };
  }
}
