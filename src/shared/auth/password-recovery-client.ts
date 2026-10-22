"use server";

import { requestPasswordReset, requestPasswordResetByWhatsApp } from "@/features/team/password-recovery";

export async function requestPasswordResetDirectAction(input: { email: string }) {
  if (!input.email || !input.email.includes("@")) throw new Error("E-mail inválido.");
  await requestPasswordReset(input.email);
  return { success: true };
}

/** Login "Esqueceu a senha?": the link goes to the person's own WhatsApp. Always the same answer. */
export async function requestPasswordResetWhatsAppAction(input: { email: string }) {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!email || !email.includes("@") || email.length > 254) throw new Error("E-mail inválido.");
  await requestPasswordResetByWhatsApp(email).catch((error) => {
    console.error("[password-reset] self_service_failed", { error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  });
  return { success: true };
}
