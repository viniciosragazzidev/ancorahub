"use server";

import { requestPasswordReset } from "@/features/team/password-recovery";

export async function requestPasswordResetAction(email: string) {
  if (!email || !email.includes("@")) throw new Error("E-mail inválido.");
  await requestPasswordReset(email);
  return { success: true };
}

// Exported for client-side use with a plain object interface
export async function requestPasswordResetDirectAction(input: { email: string }) {
  return requestPasswordResetAction(input.email);
}
