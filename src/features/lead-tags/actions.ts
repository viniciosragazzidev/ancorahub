"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import type { LeadTag } from "./rules";
import { createLeadTag, deleteLeadTag, setLeadTags, updateLeadTag } from "./service";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function run<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await work();
    revalidatePath("/conversas");
    revalidatePath("/leads");
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível salvar a tag." };
  }
}

export async function createLeadTagAction(input: { name: string; colorHue?: number | null }): Promise<Result<LeadTag>> {
  return run(async () => createLeadTag(await getRequiredTenantContext(), input));
}

export async function updateLeadTagAction(input: { id: string; name: string; colorHue: number }): Promise<Result<LeadTag>> {
  return run(async () => updateLeadTag(await getRequiredTenantContext(), input));
}

export async function deleteLeadTagAction(tagId: string): Promise<Result<null>> {
  return run(async () => {
    await deleteLeadTag(await getRequiredTenantContext(), tagId);
    return null;
  });
}

export async function setLeadTagsAction(input: { leadId: string; tagIds: string[] }): Promise<Result<LeadTag[]>> {
  return run(async () => setLeadTags(await getRequiredTenantContext(), input));
}
