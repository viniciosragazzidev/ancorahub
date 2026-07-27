"use server";

import { acceptTeamInvite } from "@/features/team/invites";

export async function acceptInviteAction(formData: FormData) {
  try { await acceptTeamInvite(String(formData.get("token") ?? ""), String(formData.get("password") ?? "")); return { success: true }; }
  catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível ativar o acesso." }; }
}
