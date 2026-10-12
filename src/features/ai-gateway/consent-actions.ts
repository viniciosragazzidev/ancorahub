"use server";

import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { recordAiConsent } from "./consent";

const decisionSchema = z.enum(["granted", "declined", "revoked"]);

/** The broker's answer to "Usar IA nas tarefas?" (or turning it off later). Only the user decides for themself. */
export async function decideAiConsentAction(raw: "granted" | "declined" | "revoked"): Promise<{ ok: boolean }> {
  const decision = decisionSchema.safeParse(raw);
  if (!decision.success) return { ok: false };
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") return { ok: false };
  try {
    await recordAiConsent({ tenantId: context.tenantId, userId: context.userId, decision: decision.data });
    return { ok: true };
  } catch (error) {
    console.error("[ai-consent] failed", error);
    return { ok: false };
  }
}
