"use server";
import { revalidatePath } from "next/cache";
import { erpAction } from "./action-result";
import { ErpError, type ErpActionResult } from "./contracts";
import { changeReferralStatus, linkReferralLead, ReferralDuplicateError, registerReferral, searchReferralLeads } from "./referrals";

export type ReferralActionResult = ErpActionResult & { href?: string };
export type ReferralLeadOption = { id: string; name: string; phoneEnd: string; status: string };

export async function registerReferralAction(_previous: ReferralActionResult, form: FormData): Promise<ReferralActionResult> {
  let href: string | undefined;
  const result = await erpAction(async () => {
    try {
      const id = await registerReferral({ requestId: form.get("requestId"), referrerName: form.get("referrerName") ?? "", referrerUserId: form.get("referrerUserId") || null,
        referrerContact: form.get("referrerContact") ?? "", channel: form.get("channel"), referredName: form.get("referredName") ?? "", referredPhone: form.get("referredPhone") ?? "",
        consent: form.get("consent") === "on", notes: form.get("notes") ?? "", ownerId: form.get("ownerId") || null });
      revalidatePath("/indicacoes");
      return { id, message: "Indicação registrada." };
    } catch (error) {
      if (error instanceof ReferralDuplicateError && error.href) href = error.href;
      throw error;
    }
  });
  return href ? { ...result, href } : result;
}

export async function changeReferralStatusAction(_previous: ReferralActionResult, form: FormData): Promise<ReferralActionResult> {
  return erpAction(async () => {
    const id = await changeReferralStatus({ id: form.get("id"), expectedVersion: Number(form.get("version")), status: form.get("status"), reason: form.get("reason") ?? "", leadId: form.get("leadId") || null });
    revalidatePath("/indicacoes");
    return { id, message: "Etapa atualizada e registrada no histórico." };
  });
}

export async function linkReferralLeadAction(_previous: ReferralActionResult, form: FormData): Promise<ReferralActionResult> {
  return erpAction(async () => {
    const id = await linkReferralLead({ id: form.get("id"), expectedVersion: Number(form.get("version")), leadId: form.get("leadId") });
    revalidatePath("/indicacoes");
    return { id, message: "Negócio vinculado à indicação." };
  });
}

export async function searchReferralLeadsAction(query: string): Promise<{ ok: true; leads: ReferralLeadOption[] } | { ok: false; message: string }> {
  try { return { ok: true, leads: await searchReferralLeads(query) }; }
  catch (error) { return { ok: false, message: error instanceof ErpError ? error.message : "Não foi possível buscar negócios agora." }; }
}
