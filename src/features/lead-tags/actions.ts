"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import type { LeadTag } from "./rules";
import { createLeadTag, deleteLeadTag, mergeLeadTags, setLeadTags, updateLeadTag, type LeadTagMergeResult } from "./service";

type Result<T> = { success: true; data: T } | { success: false; error: string };

async function run<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    const data = await work();
    revalidatePath("/conversas");
    revalidatePath("/leads");
    revalidatePath("/settings");
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

/** Joins one tag into another (same company): assignments move without duplicates and the source is deleted. */
export async function mergeLeadTagsAction(input: { sourceId: string; targetId: string }): Promise<Result<LeadTagMergeResult>> {
  return run(async () => mergeLeadTags(await getRequiredTenantContext(), input));
}
