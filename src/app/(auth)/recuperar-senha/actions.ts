"use server";

import { completePasswordReset } from "@/features/team/password-recovery";

export type ResetPasswordState = { success?: boolean; error?: string };

export async function completePasswordResetAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  try {
    const token = String(formData.get("token") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!token) throw new Error("Token de recuperação inválido.");
    if (password.length < 8) throw new Error("A senha deve ter no mínimo 8 caracteres.");
    if (password !== confirmPassword) throw new Error("As senhas não coincidem.");

    await completePasswordReset(token, password);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao redefinir senha." };
  }
}
