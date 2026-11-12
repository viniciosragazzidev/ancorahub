import "server-only";

import { randomUUID } from "node:crypto";

import { and, count, eq, gte, inArray, isNull } from "drizzle-orm";

import { logAiUsage } from "@/features/ai-agent/ai-usage-log";
import { cleanTranscript, estimateTranscriptionCostUsd, readOggDurationSeconds } from "@/features/ai-agent/audio-transcription/rules";
import { resolveTranscriptionTarget, transcribeAudio } from "@/features/ai-agent/audio-transcription/transcriber";
import { getDatabase, schema } from "@/shared/db";
import { downloadR2Object } from "@/shared/storage/r2-storage";

import type { AutoSaleSettings } from "./settings";

export type DealAudioOutcome = { kind: "transcribed"; text: string; costUsd: number } | { kind: "declined"; reason: "over_limit" | "too_long" | "no_file" | "failed" } | { kind: "skipped" };

const PLACEHOLDER = /^\[(audio|unsupported)\]$/i;

/**
 * Áudio do cliente numa negociação (§8, D6): liga com a Venda Automatizada, sem depender da flag de áudio
 * da qualificação. Limite por negociação e dia, até 5 min. Reaproveita o transcritor e a tabela
 * `lead_audio_transcriptions` (sem `slot`; idempotente por mensagem).
 */
export async function prepareDealAudio(input: { tenantId: string; leadId: string; dealId: string; dealCreatedAt: Date; providerMessageId: string; settings: AutoSaleSettings }): Promise<DealAudioOutcome> {
  const db = getDatabase();
  const [message] = await db.select({ body: schema.whatsappMessages.body, mediaKind: schema.whatsappMessages.mediaKind, mediaMimeType: schema.whatsappMessages.mediaMimeType, mediaStorageKey: schema.whatsappMessages.mediaStorageKey })
    .from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, input.tenantId), eq(schema.whatsappMessages.messageId, input.providerMessageId))).limit(1);
  if (!message) return { kind: "skipped" };
  const body = message.body?.trim() ?? "";
  if (body && !PLACEHOLDER.test(body)) return { kind: "transcribed", text: body, costUsd: 0 };

  const [previous] = await db.select({ status: schema.leadAudioTranscriptions.status }).from(schema.leadAudioTranscriptions)
    .where(and(eq(schema.leadAudioTranscriptions.tenantId, input.tenantId), eq(schema.leadAudioTranscriptions.providerMessageId, input.providerMessageId))).limit(1);
  if (previous) return previous.status === "transcribed" ? { kind: "declined", reason: "failed" } : previous.status === "pending" ? { kind: "skipped" } : { kind: "declined", reason: previous.status as "over_limit" | "too_long" | "no_file" | "failed" };

  const decline = async (reason: "over_limit" | "too_long" | "no_file" | "failed", durationSeconds: number | null = null) => {
    await db.insert(schema.leadAudioTranscriptions).values({ id: randomUUID(), tenantId: input.tenantId, leadId: input.leadId, providerMessageId: input.providerMessageId, slot: null, status: reason, durationSeconds: durationSeconds != null ? String(durationSeconds) : null }).onConflictDoNothing();
    return { kind: "declined" as const, reason };
  };
  if (!message.mediaStorageKey || message.mediaKind !== "audio") return decline("no_file");

  const dayStart = new Date(Math.max(input.dealCreatedAt.getTime(), Date.now() - 86_400_000));
  const [used] = await db.select({ total: count() }).from(schema.leadAudioTranscriptions).where(and(
    eq(schema.leadAudioTranscriptions.tenantId, input.tenantId), eq(schema.leadAudioTranscriptions.leadId, input.leadId), isNull(schema.leadAudioTranscriptions.slot),
    inArray(schema.leadAudioTranscriptions.status, ["pending", "transcribed", "failed"]), gte(schema.leadAudioTranscriptions.createdAt, dayStart),
  ));
  if (Number(used?.total ?? 0) >= input.settings.audioPerDealPerDay) return decline("over_limit");

  const target = await resolveTranscriptionTarget();
  if (!target) return decline("failed");
  const audio = new Uint8Array(await (await downloadR2Object(message.mediaStorageKey)).arrayBuffer());
  const durationSeconds = readOggDurationSeconds(audio);
  const withinLimit = durationSeconds !== null ? durationSeconds <= input.settings.audioMaxSeconds : audio.byteLength <= 5 * 1024 * 1024;
  if (!withinLimit) return decline("too_long", durationSeconds);

  const id = randomUUID();
  const inserted = await db.insert(schema.leadAudioTranscriptions).values({ id, tenantId: input.tenantId, leadId: input.leadId, providerMessageId: input.providerMessageId, slot: null, status: "pending", durationSeconds: durationSeconds != null ? String(durationSeconds) : null, provider: target.provider, model: target.model })
    .onConflictDoNothing().returning({ id: schema.leadAudioTranscriptions.id });
  if (!inserted[0]) return { kind: "skipped" };
  const startedAt = Date.now();
  try {
    const result = await transcribeAudio({ target, audio, mimeType: message.mediaMimeType ?? "audio/ogg" });
    const text = cleanTranscript(result.text);
    const seconds = durationSeconds ?? result.durationSeconds;
    const cost = estimateTranscriptionCostUsd(target.provider, seconds) ?? 0;
    if (!text) {
      await db.update(schema.leadAudioTranscriptions).set({ status: "failed", error: "sem fala reconhecida", estimatedCostUsd: String(cost), updatedAt: new Date() }).where(eq(schema.leadAudioTranscriptions.id, id));
      return { kind: "declined", reason: "failed" };
    }
    await db.update(schema.whatsappMessages).set({ body: text }).where(and(eq(schema.whatsappMessages.tenantId, input.tenantId), eq(schema.whatsappMessages.messageId, input.providerMessageId), inArray(schema.whatsappMessages.body, ["[audio]", "[AUDIO]", "[unsupported]", ""])));
    await db.update(schema.leadAudioTranscriptions).set({ status: "transcribed", durationSeconds: seconds != null ? String(seconds) : null, estimatedCostUsd: String(cost), updatedAt: new Date() }).where(eq(schema.leadAudioTranscriptions.id, id));
    await logAiUsage({ tenantId: input.tenantId, purpose: "auto_sale_audio", model: target.model, startedAt, usage: { cost }, success: true, leadId: input.leadId });
    return { kind: "transcribed", text, costUsd: cost };
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 200) : "unknown";
    await db.update(schema.leadAudioTranscriptions).set({ status: "failed", error: detail, updatedAt: new Date() }).where(eq(schema.leadAudioTranscriptions.id, id));
    await logAiUsage({ tenantId: input.tenantId, purpose: "auto_sale_audio", model: target.model, startedAt, success: false, error: detail, leadId: input.leadId });
    return { kind: "declined", reason: "failed" };
  }
}
