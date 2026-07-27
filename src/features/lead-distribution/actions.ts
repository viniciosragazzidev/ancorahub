"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { routeLeadToBranch, assignLeadToBroker, processQueuedLead } from "./service";
import { enqueueLeadDistributionJob } from "./jobs";

export type DistributionActionState = { success?: boolean; message?: string; error?: string; processed?: number; conflicts?: number };
const leadId = z.string().uuid();
const branchId = z.string().uuid();
const brokerId = z.string().uuid();

function refreshDistribution() {
  revalidatePath("/leads");
  revalidatePath("/leads/distribuicao");
  revalidatePath("/dashboard");
}

export async function routeLeadToBranchAction(_previous: DistributionActionState, formData: FormData): Promise<DistributionActionState> {
  const parsed = z.object({ leadId, branchId, reason: z.string().trim().min(3).max(200).optional() }).safeParse({ leadId: formData.get("leadId"), branchId: formData.get("branchId"), reason: String(formData.get("reason") ?? "") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Selecione uma unidade válida." };
  try { const context = await getRequiredTenantContext(); const result = await routeLeadToBranch(context, parsed.data.leadId, parsed.data.branchId, parsed.data.reason); if (result.status !== "routed") return { error: result.status === "conflict" ? "Este lead já foi atribuído." : "A unidade não pode receber leads agora." }; await enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: parsed.data.leadId }); refreshDistribution(); return { success: true, message: "Lead enviado para a fila da unidade." }; } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível enviar o lead para a unidade." }; }
}

export async function assignLeadToBrokerAction(_previous: DistributionActionState, formData: FormData): Promise<DistributionActionState> {
  const parsed = z.object({ leadId, brokerId, reason: z.string().trim().min(3).max(200).optional() }).safeParse({ leadId: formData.get("leadId"), brokerId: formData.get("brokerId"), reason: String(formData.get("reason") ?? "") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Selecione um corretor válido." };
  try { const result = await assignLeadToBroker(await getRequiredTenantContext(), parsed.data.leadId, parsed.data.brokerId, undefined, parsed.data.reason); if (result.status !== "assigned") return { error: result.reason }; refreshDistribution(); return { success: true, message: "Lead atribuído ao corretor." }; } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível atribuir o lead." }; }
}

export async function distributeLeadAutomaticallyAction(_previous: DistributionActionState, formData: FormData): Promise<DistributionActionState> {
  const parsed = leadId.safeParse(formData.get("leadId"));
  if (!parsed.success) return { error: "Lead inválido." };
  try { const result = await processQueuedLead(await getRequiredTenantContext(), parsed.data); refreshDistribution(); return result.status === "assigned" ? { success: true, message: "Lead distribuído automaticamente." } : { error: result.reason }; } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível distribuir o lead." }; }
}

export async function distributeLeadBatchAction(_previous: DistributionActionState, formData: FormData): Promise<DistributionActionState> {
  const ids = String(formData.get("leadIds") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const parsed = z.array(leadId).safeParse(ids);
  if (!parsed.success || !parsed.data.length) return { error: "Selecione ao menos um lead válido." };
  const branch = branchId.safeParse(formData.get("branchId"));
  if (!branch.success) return { error: "Selecione uma unidade." };
  try { const context = await getRequiredTenantContext(); let processed = 0; let conflicts = 0; for (const id of parsed.data) { const result = await routeLeadToBranch(context, id, branch.data, "Distribuição em lote"); if (result.status === "routed") processed += 1; else conflicts += 1; } refreshDistribution(); return { success: conflicts === 0, processed, conflicts, message: `${processed} lead${processed === 1 ? "" : "s"} enviado${processed === 1 ? "" : "s"} para a unidade.` }; } catch (error) { return { error: error instanceof Error ? error.message : "Não foi possível processar o lote." }; }
}
