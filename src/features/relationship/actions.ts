"use server";

import { revalidatePath } from "next/cache";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { audienceSchema, canSend, resolveAudience } from "./audience";
import { acknowledge, getBroadcastRecipients, markInboxRead, sendBroadcast } from "./service";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function enabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.RELATIONSHIP_CENTER).catch(() => "false")) === "true";
}

function failure(error: unknown): { ok: false; error: string } {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    return { ok: false, error: issues[0]?.message ?? "Confira os campos." };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Não consegui concluir agora." };
}

/** How many people (and who) an audience reaches right now, resolved on the server. */
export async function previewAudienceAction(raw: unknown): Promise<Result<{ count: number; names: string[]; label: string }>> {
  try {
    if (!(await enabled())) return { ok: false, error: "A Central de relacionamento está desligada." };
    const context = await getRequiredTenantContext();
    if (!canSend(context)) return { ok: false, error: "Sem permissão." };
    const { brokers, label } = await resolveAudience(context, audienceSchema.parse(raw));
    return { ok: true, data: { count: brokers.length, names: brokers.slice(0, 40).map((broker) => broker.name), label } };
  } catch (error) {
    return failure(error);
  }
}

export async function sendBroadcastAction(raw: unknown): Promise<Result<{ id: string; recipients: number; label: string }>> {
  try {
    if (!(await enabled())) return { ok: false, error: "A Central de relacionamento está desligada." };
    const context = await getRequiredTenantContext();
    const sent = await sendBroadcast(context, raw);
    revalidatePath("/relacionamento");
    return { ok: true, data: { id: sent.id, recipients: sent.recipients, label: sent.label } };
  } catch (error) {
    return failure(error);
  }
}

export async function broadcastRecipientsAction(broadcastId: string) {
  try {
    const context = await getRequiredTenantContext();
    const rows = await getBroadcastRecipients(context, String(broadcastId).slice(0, 80));
    return { ok: true as const, data: rows.map((row) => ({ brokerId: row.brokerId, name: row.name, readAt: row.readAt?.toISOString() ?? null, ackAt: row.ackAt?.toISOString() ?? null })) };
  } catch (error) {
    return failure(error);
  }
}

export async function markInboxReadAction(): Promise<Result<number>> {
  try {
    const context = await getRequiredTenantContext();
    return { ok: true, data: await markInboxRead(context) };
  } catch (error) {
    return failure(error);
  }
}

export async function acknowledgeAction(broadcastId?: string): Promise<Result<number>> {
  try {
    const context = await getRequiredTenantContext();
    const count = await acknowledge(context, broadcastId ? String(broadcastId).slice(0, 80) : undefined);
    revalidatePath("/relacionamento");
    return { ok: true, data: count };
  } catch (error) {
    return failure(error);
  }
}
