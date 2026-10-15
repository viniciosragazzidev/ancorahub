"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { requalifyColdLeadsManually } from "./cold-lead-requalification";

const inputSchema = z.object({
  queueId: z.string().uuid(),
  leadIds: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
});

export async function requalifyColdLeadsAction(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Selecione uma fila e ate 500 leads validos." };
  try {
    const context = await getRequiredTenantContext();
    const result = await requalifyColdLeadsManually(context, parsed.data);
    revalidatePath("/leads/distribuicao");
    return { success: true as const, ...result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Nao foi possivel requalificar os leads." };
  }
}
