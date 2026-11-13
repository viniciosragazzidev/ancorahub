"use server";
import { revalidatePath } from "next/cache";
import { erpAction } from "./action-result";
import { ErpError, type ErpActionResult } from "./contracts";
import {
  approveIncentiveCampaign, cancelIncentiveCampaign, contestIncentiveResult, createIncentiveCampaign, getIncentiveCampaign, runIncentiveCalculation,
  updateIncentiveCampaign,
} from "./incentives";

export type IncentiveCampaignData = Awaited<ReturnType<typeof getIncentiveCampaign>>;

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

function campaignFromForm(form: FormData) {
  return {
    name: text(form, "name"),
    regulation: text(form, "regulation"),
    metric: text(form, "metric"),
    startsOn: text(form, "startsOn"),
    endsOn: text(form, "endsOn"),
    branchIds: form.getAll("branchIds").filter((value): value is string => typeof value === "string" && value.length > 0),
    prize: text(form, "prize"),
    showNames: form.get("showNames") === "on",
  };
}

function refresh(id?: string) {
  revalidatePath("/campanhas-incentivo");
  if (id) revalidatePath(`/campanhas-incentivo/${id}`);
}

export async function saveIncentiveCampaignAction(_previous: ErpActionResult, form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const existing = text(form, "id");
    const id = existing
      ? await updateIncentiveCampaign({ id: existing, expectedVersion: Number(form.get("version")), campaign: campaignFromForm(form) })
      : await createIncentiveCampaign(campaignFromForm(form));
    refresh(id);
    const message = existing
      ? "Rascunho atualizado. A aprovação precisa ser feita por outra pessoa."
      : "Rascunho criado. A aprovação precisa ser feita por outra pessoa.";
    return { id, message };
  });
}

export async function approveIncentiveCampaignAction(form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await approveIncentiveCampaign({ id: text(form, "id"), expectedVersion: Number(form.get("version")) });
    refresh(id);
    return { id, message: "Campanha aprovada. O regulamento não pode mais ser alterado." };
  });
}

export async function cancelIncentiveCampaignAction(form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await cancelIncentiveCampaign({ id: text(form, "id"), expectedVersion: Number(form.get("version")), reason: text(form, "reason") });
    refresh(id);
    return { id, message: "Campanha cancelada. Apurações anteriores continuam no histórico." };
  });
}

export async function runIncentiveCalculationAction(form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = text(form, "id");
    const kind = text(form, "kind");
    await runIncentiveCalculation({ id, expectedVersion: Number(form.get("version")), kind });
    refresh(id);
    return { id, message: kind === "final" ? "Apuração final registrada e campanha encerrada." : "Apuração prévia registrada." };
  });
}

export async function contestIncentiveResultAction(form: FormData): Promise<ErpActionResult> {
  return erpAction(async () => {
    const id = await contestIncentiveResult({ resultId: text(form, "resultId"), note: text(form, "note") });
    const campaignId = text(form, "campaignId");
    refresh(/^[\w-]{1,100}$/.test(campaignId) ? campaignId : undefined);
    return { id, message: "Contestação registrada para análise. O resultado não muda automaticamente." };
  });
}

/** Summary for the list drawer: same service, same scope and audit as the full view (first page of the history). */
export async function getIncentiveCampaignAction(id: string): Promise<{ ok: true; data: IncentiveCampaignData } | { ok: false; message: string }> {
  try {
    return { ok: true, data: await getIncentiveCampaign(id) };
  } catch (error) {
    return { ok: false, message: error instanceof ErpError ? error.message : "Não foi possível abrir a campanha agora." };
  }
}
