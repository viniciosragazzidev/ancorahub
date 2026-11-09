"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { wakeLeadsAwaitingEligibleBroker } from "@/features/lead-distribution/jobs";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext, invalidateTenantContextCache } from "@/shared/auth/tenant-context";
import { BrokerUnitChangeError, changeOwnBranch } from "./service";

export type ChangeOwnBranchState =
  | { ok: true; branchName: string; changed: boolean; releasedAssignments: number }
  | { ok: false; error: string };

const branchIdInput = z.string().trim().min(1).max(80);

/** Broker changes their own unit from Configurações (DEC-170). Everything is checked on the server. */
export async function changeOwnBranchAction(rawBranchId: unknown): Promise<ChangeOwnBranchState> {
  const parsed = branchIdInput.safeParse(rawBranchId);
  if (!parsed.success) return { ok: false, error: "Escolha uma unidade." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "broker") return { ok: false, error: "Só o corretor pode trocar a própria unidade por aqui." };
    if ((await getFeatureFlag(FEATURE_FLAGS.BROKER_SELF_UNIT_CHANGE)) !== "true") {
      return { ok: false, error: "A troca de unidade está desligada no momento. Fale com a gestão." };
    }
    const result = await changeOwnBranch(context, parsed.data);
    if (result.changed) {
      invalidateTenantContextCache(context.userId);
      // Now eligible in the new unit: leads waiting there for a broker get another try.
      await wakeLeadsAwaitingEligibleBroker(context.tenantId).catch(() => 0);
      revalidatePath("/settings");
    }
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof BrokerUnitChangeError) return { ok: false, error: error.message };
    return { ok: false, error: "Não consegui trocar sua unidade agora. Tente de novo em instantes." };
  }
}
