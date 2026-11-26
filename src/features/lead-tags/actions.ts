"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import type { BulkLeadTagMode, LeadTag } from "./rules";
import { bulkApplyLeadTag, createLeadTag, deleteLeadTag, mergeLeadTags, setLeadTags, updateLeadTag, type BulkLeadTagResult, type LeadTagMergeResult } from "./service";

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

/** "Etiquetar" em lote em /leads: aplica ou remove uma etiqueta da empresa nos leads selecionados. */
export async function bulkSetLeadTagAction(input: { leadIds: string[]; tagId: string; mode: BulkLeadTagMode }): Promise<Result<BulkLeadTagResult>> {
  return run(async () => bulkApplyLeadTag(await getRequiredTenantContext(), {
    leadIds: Array.isArray(input?.leadIds) ? input.leadIds : [],
    tagId: String(input?.tagId ?? ""),
    mode: input?.mode,
  }));
}

/** Joins one tag into another (same company): assignments move without duplicates and the source is deleted. */
export async function mergeLeadTagsAction(input: { sourceId: string; targetId: string }): Promise<Result<LeadTagMergeResult>> {
  return run(async () => mergeLeadTags(await getRequiredTenantContext(), input));
}
