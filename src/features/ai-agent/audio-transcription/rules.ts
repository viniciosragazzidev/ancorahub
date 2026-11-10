/**
 * Regras puras da IA que entende áudio (10/11/2026): só lead em qualificação,
 * só os 2 primeiros áudios, até 2 minutos. Plano em
 * docs/implementations/active/2026-11-10-ia-qualificacao-audio.md.
 */

/** Quantos áudios de cada lead vão para transcrição. */
export const AUDIO_TRANSCRIPTIONS_PER_LEAD = 2;
/** Duração máxima aceita (nota de voz longa pede resumo por escrito). */
export const AUDIO_TRANSCRIPTION_MAX_SECONDS = 120;
/** Formato sem duração legível no arquivo: teto de tamanho no lugar dos 2 minutos. */
export const AUDIO_TRANSCRIPTION_MAX_BYTES_WITHOUT_DURATION = 2 * 1024 * 1024;
/** Texto transcrito guardado na mensagem (uma nota de 2 min tem bem menos que isso). */
export const AUDIO_TRANSCRIPT_MAX_CHARS = 4_000;

export type AudioDeclineReason = "over_limit" | "too_long" | "no_file" | "failed";

const QUALIFYING_CONVERSATION_STATUSES = new Set(["NEW", "AI_ACTIVE", "WAITING_CUSTOMER"]);
const QUALIFYING_LEAD_STATUSES = new Set(["pending", "qualifying"]);

/**
 * Lead "em qualificação": a IA ainda conduz as perguntas. Fora disso (com o
 * corretor, qualificado, frio, aguardando humano, segurado pelo diretor ou
 * turno só de correção) o áudio segue como hoje, sem transcrição.
 */
export function isLeadInQualificationForAudio(input: {
  conversationStatus: string | null | undefined;
  automationState?: string | null;
  qualificationStatus: string | null | undefined;
  distributionStatus?: string | null;
  corretorId?: string | null;
  correctionOnly?: boolean;
}) {
  if (input.correctionOnly) return false;
  if (!QUALIFYING_CONVERSATION_STATUSES.has(input.conversationStatus ?? "")) return false;
  if (input.automationState && input.automationState !== "AI_ACTIVE") return false;
  if (!QUALIFYING_LEAD_STATUSES.has(input.qualificationStatus ?? "")) return false;
  if (input.distributionStatus === "manual_hold") return false;
  if (input.corretorId) return false;
  return true;
}

/** Próxima vez livre do lead (1 ou 2), ou null quando as duas já foram usadas. */
export function nextAudioSlot(usedSlots: readonly number[]): number | null {
  for (let slot = 1; slot <= AUDIO_TRANSCRIPTIONS_PER_LEAD; slot += 1) {
    if (!usedSlots.includes(slot)) return slot;
  }
  return null;
}

const OGG_CAPTURE = [0x4f, 0x67, 0x67, 0x53]; // "OggS"

function indexOfBytes(bytes: Uint8Array, pattern: readonly number[], from = 0, to = bytes.length) {
  const last = Math.min(to, bytes.length) - pattern.length;
  for (let index = from; index <= last; index += 1) {
    let match = true;
    for (let offset = 0; offset < pattern.length; offset += 1) {
      if (bytes[index + offset] !== pattern[offset]) { match = false; break; }
    }
    if (match) return index;
  }
  return -1;
}

function lastIndexOfBytes(bytes: Uint8Array, pattern: readonly number[]) {
  for (let index = bytes.length - pattern.length; index >= 0; index -= 1) {
    let match = true;
    for (let offset = 0; offset < pattern.length; offset += 1) {
      if (bytes[index + offset] !== pattern[offset]) { match = false; break; }
    }
    if (match) return index;
  }
  return -1;
}

const ascii = (text: string) => Array.from(text, (character) => character.charCodeAt(0));

/**
 * Duração de um arquivo OGG (Opus, a nota de voz do WhatsApp, ou Vorbis) lida
 * do próprio arquivo, sem enviar a ninguém: a posição da última página dividida
 * pela taxa de amostragem. null quando não é OGG ou o cabeçalho não é legível.
 */
export function readOggDurationSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 28 || indexOfBytes(bytes, OGG_CAPTURE, 0, 4) !== 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sampleRate: number | null = null;
  let preSkip = 0;
  const opusHead = indexOfBytes(bytes, ascii("OpusHead"), 0, 512);
  if (opusHead >= 0 && opusHead + 12 <= bytes.length) {
    sampleRate = 48_000; // Opus sempre conta a 48 kHz, qualquer que seja a taxa original.
    preSkip = view.getUint16(opusHead + 10, true);
  } else {
    const vorbis = indexOfBytes(bytes, [0x01, ...ascii("vorbis")], 0, 512);
    if (vorbis >= 0 && vorbis + 16 <= bytes.length) sampleRate = view.getUint32(vorbis + 12, true);
  }
  if (!sampleRate) return null;
  const lastPage = lastIndexOfBytes(bytes, OGG_CAPTURE);
  if (lastPage < 0 || lastPage + 14 > bytes.length) return null;
  const granule = view.getBigInt64(lastPage + 6, true);
  if (granule <= BigInt(0)) return null;
  const seconds = (Number(granule) - preSkip) / sampleRate;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds * 100) / 100 : null;
}

/** O áudio cabe no limite? Sem duração legível, vale o teto de tamanho. */
export function isAudioWithinLimit(input: { durationSeconds: number | null; sizeBytes: number }) {
  if (input.durationSeconds !== null) return input.durationSeconds <= AUDIO_TRANSCRIPTION_MAX_SECONDS;
  return input.sizeBytes <= AUDIO_TRANSCRIPTION_MAX_BYTES_WITHOUT_DURATION;
}

export type TranscriptionProvider = "groq" | "openai";

/** Modelo de cada provedor: Whisper turbo no Groq, o mini de transcrição na OpenAI. */
export const TRANSCRIPTION_MODELS: Record<TranscriptionProvider, string> = {
  groq: "whisper-large-v3-turbo",
  openai: "gpt-4o-mini-transcribe",
};

/** Preço público por minuto de áudio (US$), conferido em 10/11/2026. */
const PRICE_PER_MINUTE_USD: Record<TranscriptionProvider, number> = {
  groq: 0.04 / 60,
  openai: 0.003,
};
/** O Groq cobra no mínimo 10 s por chamada. */
const MINIMUM_BILLED_SECONDS: Record<TranscriptionProvider, number> = { groq: 10, openai: 0 };

/** Custo estimado de uma transcrição, para o registro de uso. */
export function estimateTranscriptionCostUsd(provider: TranscriptionProvider, durationSeconds: number | null) {
  if (durationSeconds === null || !Number.isFinite(durationSeconds)) return null;
  const billed = Math.max(durationSeconds, MINIMUM_BILLED_SECONDS[provider]);
  return Math.round((billed / 60) * PRICE_PER_MINUTE_USD[provider] * 1_000_000) / 1_000_000;
}

/** Texto do provedor limpo para virar a mensagem do cliente. Vazio quando não há fala. */
export function cleanTranscript(text: string | null | undefined) {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > AUDIO_TRANSCRIPT_MAX_CHARS ? `${clean.slice(0, AUDIO_TRANSCRIPT_MAX_CHARS - 1)}…` : clean;
}

/** O que a IA responde quando não ouve o áudio: sempre pedindo, com gentileza, para escrever. */
export const AUDIO_DECLINE_TEXTS: Record<AudioDeclineReason, string> = {
  over_limit: "Por aqui não consigo ouvir mais áudios. Pode me mandar a resposta por escrito, por favor?",
  too_long: "Esse áudio ficou um pouco longo e não consegui ouvir por aqui. Pode me mandar um resumo por escrito, por favor?",
  no_file: "Não consegui ouvir seu áudio. Pode me mandar a resposta por escrito, por favor?",
  failed: "Não consegui ouvir seu áudio. Pode me mandar a resposta por escrito, por favor?",
};

/** A última mensagem da IA já foi um pedido para escrever: não repete a cada áudio. */
export function isAudioDeclineText(body: string | null | undefined) {
  const text = (body ?? "").trim();
  return Object.values(AUDIO_DECLINE_TEXTS).includes(text);
}
