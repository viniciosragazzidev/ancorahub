"use server";

import { revalidatePath } from "next/cache";

import { archiveCustomRole, assignCustomRole, saveCustomRole } from "@/features/custom-roles/service";

export async function saveCustomRoleAction(input: unknown) {
  const result = await saveCustomRole(input);
  revalidatePath("/equipe/cargos");
  revalidatePath("/equipe");
  return result;
}

export async function archiveCustomRoleAction(roleId: string) {
  await archiveCustomRole(roleId);
  revalidatePath("/equipe/cargos");
  revalidatePath("/equipe");
}

export async function assignCustomRoleAction(memberId: string, roleId: string | null) {
  await assignCustomRole(memberId, roleId);
  revalidatePath("/equipe");
  revalidatePath("/equipe/cargos");
}
