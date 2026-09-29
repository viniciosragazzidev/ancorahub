"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { listAttendanceFlowQueues, startLeadInQueueFlow } from "./manual-start";
import { attendanceFlowsEnabled } from "./runtime";

/** Queues a director can start a lead's attendance in; null hides the option (switch off, other roles). */
export async function getAttendanceFlowQueueOptionsAction() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" || !(await attendanceFlowsEnabled().catch(() => false))) return null;
  return listAttendanceFlowQueues(context.tenantId);
}

const startSchema = z.object({ leadId: z.string().uuid(), queueId: z.string().uuid() });

export async function startLeadAttendanceFlowAction(input: { leadId: string; queueId: string }): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Escolha uma fila válida." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Apenas o Diretor pode iniciar o atendimento por fluxo." };
    const result = await startLeadInQueueFlow({ tenantId: context.tenantId, leadId: parsed.data.leadId, queueId: parsed.data.queueId, actorUserId: context.userId });
    revalidatePath("/leads");
    if (!result.started) return { success: false, error: result.error };
    return {
      success: true,
      message: result.waitingForAgent
        ? "Atendimento iniciado: a IA está conversando com o lead e passa para a distribuição ao concluir."
        : "Atendimento iniciado pelo fluxo da fila.",
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível iniciar o atendimento." };
  }
}
