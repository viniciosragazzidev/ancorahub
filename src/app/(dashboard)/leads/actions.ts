"use server";

import { redirect } from "next/navigation";
import { createManualLead } from "@/features/leads/manual-create";

export type LeadCreateState = { duplicate?: { id: string; nome: string; createdAt: string; corretorNome: string | null }; error?: string };

export async function createManualLeadAction(_previous: LeadCreateState, formData: FormData): Promise<LeadCreateState> {
  let result: Awaited<ReturnType<typeof createManualLead>>;
  try {
    result = await createManualLead(Object.fromEntries(formData));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o lead." };
  }

  if (result.duplicate) return { duplicate: { id: result.duplicate.id, nome: result.duplicate.nome, createdAt: result.duplicate.createdAt.toISOString(), corretorNome: result.duplicate.corretorNome } };
  redirect(`/leads/${result.leadId}`);
}
