import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { isUndefinedTableError } from "@/shared/db/postgres-errors";
import { downloadR2Object } from "@/shared/storage/r2-storage";

import { logAiUsage } from "../ai-usage-log";
import { isAiAudioTranscriptionEnabled } from "./flag";
import {
  type AudioDeclineReason,
  cleanTranscript,
  estimateTranscriptionCostUsd,
  isAudioWithinLimit,
  isLeadInQualificationForAudio,
  nextAudioSlot,
  readOggDurationSeconds,
} from "./rules";
import { resolveTranscriptionTarget, transcribeAudio } from "./transcriber";

export type QualificationAudioOutcome =
  /** Nada muda: o áudio segue como hoje ("O cliente enviou um áudio."). */
  | { kind: "skipped"; reason: "flag_off" | "not_in_qualification" | "unavailable" }
  /** Texto do áudio: a IA responde ao que foi dito. */
  | { kind: "transcribed"; text: string }
  /** Não ouvido: a IA pede, com gentileza, para escrever. */
  | { kind: "declined"; reason: AudioDeclineReason };

const PLACEHOLDER = /^\[(audio|unsupported)\]$/i;
const DECLINE_STATUSES = new Set<AudioDeclineReason>(["over_limit", "too_long", "no_file", "failed"]);

type Db = ReturnType<typeof getDatabase>;

async function readMessage(db: Db, tenantId: string, providerMessageId: string) {
  const [row] = await db.select({
    body: schema.whatsappMessages.body,
    mediaKind: schema.whatsappMessages.mediaKind,
    mediaMimeType: schema.whatsappMessages.mediaMimeType,
    mediaSizeBytes: schema.whatsappMessages.mediaSizeBytes,
    mediaStorageKey: schema.whatsappMessages.mediaStorageKey,
  }).from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.messageId, providerMessageId)))
    .limit(1);
  return row ?? null;
}

/** Resultado já gravado para esta mensagem (o mesmo áudio nunca gasta duas vezes). */
async function previousOutcome(db: Db, tenantId: string, providerMessageId: string): Promise<QualificationAudioOutcome | null> {
  const [previous] = await db.select({ status: schema.leadAudioTranscriptions.status })
    .from(schema.leadAudioTranscriptions)
    .where(and(eq(schema.leadAudioTranscriptions.tenantId, tenantId), eq(schema.leadAudioTranscriptions.providerMessageId, providerMessageId)))
    .limit(1);
  if (!previous) return null;
  if (previous.status === "transcribed") {
    const message = await readMessage(db, tenantId, providerMessageId);
    const text = message?.body?.trim() ?? "";
    return text && !PLACEHOLDER.test(text) ? { kind: "transcribed", text } : { kind: "declined", reason: "failed" };
  }
  if (DECLINE_STATUSES.has(previous.status as AudioDeclineReason)) return { kind: "declined", reason: previous.status as AudioDeclineReason };
  // "pending": outro turno está transcrevendo este mesmo áudio agora.
  return { kind: "skipped", reason: "unavailable" };
}

/** Registra um áudio que não foi ao provedor (não gasta a vez). */
async function recordDecline(db: Db, input: { tenantId: string; leadId: string; providerMessageId: string; reason: AudioDeclineReason; durationSeconds?: number | null }) {
  await db.insert(schema.leadAudioTranscriptions).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    providerMessageId: input.providerMessageId,
    slot: null,
    status: input.reason,
    durationSeconds: input.durationSeconds != null ? String(input.durationSeconds) : null,
  }).onConflictDoNothing();
  return { kind: "declined" as const, reason: input.reason };
}

/** Reserva a vez 1 ou 2 do lead; o índice único impede passar de 2 com áudios simultâneos. */
async function reserveSlot(db: Db, input: { tenantId: string; leadId: string; providerMessageId: string; durationSeconds: number | null; provider: string; model: string }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const used = await db.select({ slot: schema.leadAudioTranscriptions.slot })
      .from(schema.leadAudioTranscriptions)
      .where(and(
        eq(schema.leadAudioTranscriptions.tenantId, input.tenantId),
        eq(schema.leadAudioTranscriptions.leadId, input.leadId),
        isNotNull(schema.leadAudioTranscriptions.slot),
      ));
    const slot = nextAudioSlot(used.map((row) => row.slot ?? 0));
    if (slot === null) return null;
    const id = randomUUID();
    const inserted = await db.insert(schema.leadAudioTranscriptions).values({
      id,
      tenantId: input.tenantId,
      leadId: input.leadId,
      providerMessageId: input.providerMessageId,
      slot,
      status: "pending",
      durationSeconds: input.durationSeconds != null ? String(input.durationSeconds) : null,
      provider: input.provider,
      model: input.model,
    }).onConflictDoNothing().returning({ id: schema.leadAudioTranscriptions.id });
    if (inserted[0]) return { id, slot };
    // Conflito: ou outro áudio levou esta vez (tenta a próxima), ou esta mensagem já tem registro.
    const [sameMessage] = await db.select({ id: schema.leadAudioTranscriptions.id }).from(schema.leadAudioTranscriptions)
      .where(and(eq(schema.leadAudioTranscriptions.tenantId, input.tenantId), eq(schema.leadAudioTranscriptions.providerMessageId, input.providerMessageId)))
      .limit(1);
    if (sameMessage) return "already_recorded" as const;
  }
  return null;
}

/**
 * Áudio de um lead em qualificação: os 2 primeiros (até 2 min) viram texto na
 * própria mensagem, que a IA, o histórico e o corretor passam a ler; o resto
 * pede para escrever. Qualquer outro caso (flag desligada, lead fora da
 * qualificação, tabela sem migração, sem chave de provedor) devolve "skipped"
 * e o áudio segue exatamente como antes.
 */
export async function prepareQualificationAudio(input: {
  tenantId: string;
  leadId: string;
  providerMessageId: string | null | undefined;
  conversationId?: string | null;
  conversationStatus: string | null | undefined;
  automationState?: string | null;
  correctionOnly?: boolean;
}): Promise<QualificationAudioOutcome> {
  const { tenantId, leadId } = input;
  const providerMessageId = input.providerMessageId?.trim();
  if (!providerMessageId) return { kind: "skipped", reason: "unavailable" };
  if (!(await isAiAudioTranscriptionEnabled(tenantId))) return { kind: "skipped", reason: "flag_off" };

  const db = getDatabase();
  const [lead] = await db.select({
    qualificationStatus: schema.leads.qualificationStatus,
    distributionStatus: schema.leads.distributionStatus,
    corretorId: schema.leads.corretorId,
  }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
  if (!lead || !isLeadInQualificationForAudio({
    conversationStatus: input.conversationStatus,
    automationState: input.automationState,
    qualificationStatus: lead.qualificationStatus,
    distributionStatus: lead.distributionStatus,
    corretorId: lead.corretorId,
    correctionOnly: input.correctionOnly,
  })) return { kind: "skipped", reason: "not_in_qualification" };

  let reservation: { id: string; slot: number } | null = null;
  try {
    const previous = await previousOutcome(db, tenantId, providerMessageId);
    if (previous) return previous;

    const message = await readMessage(db, tenantId, providerMessageId);
    if (!message) return { kind: "skipped", reason: "unavailable" };
    const body = message.body?.trim() ?? "";
    if (body && !PLACEHOLDER.test(body)) return { kind: "transcribed", text: body };
    if (!message.mediaStorageKey || message.mediaKind !== "audio") {
      return await recordDecline(db, { tenantId, leadId, providerMessageId, reason: "no_file" });
    }

    const target = await resolveTranscriptionTarget();
    if (!target) return { kind: "skipped", reason: "unavailable" };

    // Vezes esgotadas: nem baixa o arquivo.
    const usedSlots = await db.select({ slot: schema.leadAudioTranscriptions.slot }).from(schema.leadAudioTranscriptions)
      .where(and(eq(schema.leadAudioTranscriptions.tenantId, tenantId), eq(schema.leadAudioTranscriptions.leadId, leadId), isNotNull(schema.leadAudioTranscriptions.slot)));
    if (nextAudioSlot(usedSlots.map((row) => row.slot ?? 0)) === null) {
      return await recordDecline(db, { tenantId, leadId, providerMessageId, reason: "over_limit" });
    }

    const audio = new Uint8Array(await (await downloadR2Object(message.mediaStorageKey)).arrayBuffer());
    const durationSeconds = readOggDurationSeconds(audio);
    if (!isAudioWithinLimit({ durationSeconds, sizeBytes: audio.byteLength })) {
      return await recordDecline(db, { tenantId, leadId, providerMessageId, reason: "too_long", durationSeconds });
    }

    const reserved = await reserveSlot(db, { tenantId, leadId, providerMessageId, durationSeconds, provider: target.provider, model: target.model });
    if (reserved === "already_recorded") return (await previousOutcome(db, tenantId, providerMessageId)) ?? { kind: "skipped", reason: "unavailable" };
    if (!reserved) return await recordDecline(db, { tenantId, leadId, providerMessageId, reason: "over_limit" });
    reservation = reserved;

    const startedAt = Date.now();
    let text = "";
    let providerDuration: number | null = null;
    try {
      const result = await transcribeAudio({ target, audio, mimeType: message.mediaMimeType ?? "audio/ogg" });
      text = cleanTranscript(result.text);
      providerDuration = result.durationSeconds;
    } catch (error) {
      const detail = error instanceof Error ? error.message.slice(0, 200) : "unknown";
      await db.update(schema.leadAudioTranscriptions).set({ status: "failed", error: detail, updatedAt: new Date() })
        .where(and(eq(schema.leadAudioTranscriptions.id, reserved.id), eq(schema.leadAudioTranscriptions.tenantId, tenantId)));
      await logAiUsage({ tenantId, purpose: "audio_transcription", model: target.model, startedAt, success: false, error: detail, leadId, conversationId: input.conversationId ?? null });
      console.warn("[ai-audio] transcription_failed", { tenantId, leadId, slot: reserved.slot, provider: target.provider, error: detail });
      return { kind: "declined", reason: "failed" };
    }

    const seconds = durationSeconds ?? providerDuration;
    const cost = estimateTranscriptionCostUsd(target.provider, seconds);
    if (!text) {
      await db.update(schema.leadAudioTranscriptions).set({ status: "failed", error: "sem fala reconhecida", estimatedCostUsd: cost != null ? String(cost) : null, updatedAt: new Date() })
        .where(and(eq(schema.leadAudioTranscriptions.id, reserved.id), eq(schema.leadAudioTranscriptions.tenantId, tenantId)));
      await logAiUsage({ tenantId, purpose: "audio_transcription", model: target.model, startedAt, usage: cost != null ? { cost } : null, success: false, error: "empty_transcript", leadId, conversationId: input.conversationId ?? null });
      return { kind: "declined", reason: "failed" };
    }

    // O texto vai para a própria mensagem de áudio: só troca o marcador "[audio]".
    await db.update(schema.whatsappMessages).set({ body: text })
      .where(and(
        eq(schema.whatsappMessages.tenantId, tenantId),
        eq(schema.whatsappMessages.messageId, providerMessageId),
        inArray(schema.whatsappMessages.body, ["[audio]", "[AUDIO]", "[unsupported]", ""]),
      ));
    await db.update(schema.leadAudioTranscriptions).set({
      status: "transcribed",
      durationSeconds: seconds != null ? String(seconds) : null,
      estimatedCostUsd: cost != null ? String(cost) : null,
      updatedAt: new Date(),
    }).where(and(eq(schema.leadAudioTranscriptions.id, reserved.id), eq(schema.leadAudioTranscriptions.tenantId, tenantId)));
    await logAiUsage({ tenantId, purpose: "audio_transcription", model: target.model, startedAt, usage: cost != null ? { cost } : null, success: true, leadId, conversationId: input.conversationId ?? null });
    console.info("[ai-audio] transcribed", { tenantId, leadId, slot: reserved.slot, provider: target.provider, seconds, chars: text.length });
    return { kind: "transcribed", text };
  } catch (error) {
    if (isUndefinedTableError(error)) return { kind: "skipped", reason: "unavailable" };
    console.warn("[ai-audio] prepare_failed", { tenantId, leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    if (reservation) {
      await db.update(schema.leadAudioTranscriptions).set({ status: "failed", error: "erro interno", updatedAt: new Date() })
        .where(and(eq(schema.leadAudioTranscriptions.id, reservation.id), eq(schema.leadAudioTranscriptions.tenantId, tenantId)))
        .catch(() => undefined);
      return { kind: "declined", reason: "failed" };
    }
    return { kind: "skipped", reason: "unavailable" };
  }
}
