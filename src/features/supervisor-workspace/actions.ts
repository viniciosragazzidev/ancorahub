"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase } from "@/shared/db";

import { addBrokerToSupervisorTeam } from "./team-membership-service";

/**
 * Direct P2 assignment remains available in the supervisor chat and team page.
 */
export async function addBrokerToMyTeamAction(rawBrokerId: string): Promise<{ ok: boolean; message: string }> {
  const brokerId = z.string().trim().min(1).max(80).safeParse(rawBrokerId);
  if (!brokerId.success) return { ok: false, message: "Escolha um corretor válido." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "supervisor" || !context.supervisorTeamScope || !context.branchId || (await getLiteAudience(context)) !== "supervisor") {
      return { ok: false, message: "Só o supervisor da unidade pode adicionar corretores." };
    }
    const result = await getDatabase().transaction((tx) => addBrokerToSupervisorTeam(tx, {
      tenantId: context.tenantId,
      branchId: context.branchId!,
      supervisorId: context.userId,
      brokerId: brokerId.data,
      actor: context,
    }));
    if (!result.ok) return { ok: false, message: result.reason };
    revalidatePath("/dashboard");
    revalidatePath("/equipe");
    revalidatePath("/equipe/minha");
    return { ok: true, message: "Pronto, o corretor entrou na sua equipe." };
  } catch {
    return { ok: false, message: "Não consegui adicionar agora." };
  }
}
