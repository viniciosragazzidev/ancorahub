"use server";

import { requestPasswordReset } from "@/features/team/password-recovery";

export async function requestPasswordResetDirectAction(input: { email: string }) {
  if (!input.email || !input.email.includes("@")) throw new Error("E-mail inválido.");
  await requestPasswordReset(input.email);
  return { success: true };
}
