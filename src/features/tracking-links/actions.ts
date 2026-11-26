"use server";

import { revalidatePath } from "next/cache";

import { requireCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import type { TrackingLinkInput } from "./core";
import {
  createTrackingLink,
  deleteTrackingLink,
  listTrackingLinks,
  setTrackingLinkStatus,
  trackingLinkDailyClicks,
  TrackingLinkError,
  type TrackingLinkRow,
} from "./service";

type Result<T> = { success: true; data: T } | { success: false; error: string };

const PATH = "/marketing/links";

async function guarded<T>(work: (context: { tenantId: string; userId: string }) => Promise<T>, fallback: string): Promise<Result<T>> {
  try {
    // Mesma regra da área de Marketing: diretor e a função marketing (empresa toda).
    const context = await requireCapability(await getRequiredTenantContext(), "acessar_campanhas_meta");
    const data = await work(context);
    return { success: true, data };
  } catch (error) {
    if (error instanceof TrackingLinkError) return { success: false, error: error.message };
    console.error("[tracking-links] action_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { success: false, error: fallback };
  }
}

export async function createTrackingLinkAction(input: TrackingLinkInput): Promise<Result<TrackingLinkRow>> {
  return guarded(async (context) => {
    const { id } = await createTrackingLink(context, input);
    revalidatePath(PATH);
    const page = await listTrackingLinks(context.tenantId);
    const row = page.ready ? page.links.find((link) => link.id === id) : undefined;
    if (!row) throw new TrackingLinkError("O link foi criado, mas não consegui carregar. Recarregue a página.");
    return row;
  }, "Não consegui criar o link.");
}

export async function setTrackingLinkStatusAction(input: { id: string; status: "active" | "paused" }): Promise<Result<null>> {
  return guarded(async (context) => {
    await setTrackingLinkStatus(context.tenantId, String(input?.id ?? ""), input?.status === "paused" ? "paused" : "active");
    revalidatePath(PATH);
    return null;
  }, "Não consegui mudar o link.");
}

export async function deleteTrackingLinkAction(id: string): Promise<Result<null>> {
  return guarded(async (context) => {
    await deleteTrackingLink(context.tenantId, String(id ?? ""));
    revalidatePath(PATH);
    return null;
  }, "Não consegui excluir o link.");
}

export async function trackingLinkDailyClicksAction(id: string): Promise<Result<{ day: string; clicks: number }[]>> {
  return guarded((context) => trackingLinkDailyClicks(context.tenantId, String(id ?? "")), "Não consegui carregar os cliques.");
}
