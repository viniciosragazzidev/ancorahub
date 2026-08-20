"use server";


import { archiveCustomRole, assignCustomRole, saveCustomRole } from "@/features/custom-roles/service";

export async function saveCustomRoleAction(input: unknown) {
  const result = await saveCustomRole(input);
  return result;
}

export async function archiveCustomRoleAction(roleId: string) {
  await archiveCustomRole(roleId);
}

export async function assignCustomRoleAction(memberId: string, roleId: string | null) {
  await assignCustomRole(memberId, roleId);
}
