"use server";

import { revalidatePath } from "next/cache";
import { changeLeadStatus, type ChangeLeadStatusInput } from "@/features/leads/change-lead-status";

export type StatusChangeState = {
  success?: boolean;
  error?: string;
};

export async function changeLeadStatusAction(
  _previous: StatusChangeState,
  formData: FormData,
): Promise<StatusChangeState> {
  const rawInput: ChangeLeadStatusInput = {
    leadId: formData.get("leadId") as string,
    newStatus: formData.get("newStatus") as string,
    motivoPerda: formData.get("motivoPerda") as string | null,
  };

  try {
    await changeLeadStatus(rawInput);
    revalidatePath(`/leads/${rawInput.leadId}`);
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Não foi possível alterar o status do lead.",
    };
  }
}
