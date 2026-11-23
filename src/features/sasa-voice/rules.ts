/**
 * Voz da Sasá por ElevenLabs (23/11/2026): versão de teste só para o corretor Vinicios Ragazzi. Regras puras,
 * usadas pelo servidor, pela tela e pelo laboratório. A key do ElevenLabs nunca passa por aqui.
 * Plano: docs/implementations/active/2026-11-19-sasa-agentica.md (Voz da Sasá).
 */
import type { ChatBlock } from "@/components/chat/types";

/** Quem testa: o vínculo de corretor do Vinicios (o mesmo id de `quote-availability.ts`). */
export const SASA_VOICE_PILOT_USER_IDS: readonly string[] = [
  "ebed87f7-b4f3-41c1-8e92-d234fa5a1ce1", // Vinicios Ragazzi (corretor)
];
/** Lista extra, sem deploy (ids separados por vírgula em `system_settings`). Vazia por padrão. */
export const SASA_VOICE_PILOT_SETTING = "sasa_voice_pilot_user_ids";

/** Só corretor, e só quem está na lista fixa ou na lista extra. */
export function isSasaVoicePilot(role: string | null | undefined, userId: string | null | undefined, extraIds?: string | null): boolean {
  if (role !== "broker" || !userId) return false;
  if (SASA_VOICE_PILOT_USER_IDS.includes(userId)) return true;
  return Boolean(extraIds?.split(",").map((id) => id.trim()).filter(Boolean).includes(userId));
}

/** Teto por resposta (o resto fica só no texto) e por dia, para não estourar a conta do ElevenLabs. */
export const SASA_VOICE_MAX_CHARS_PER_REPLY = 500;
export const SASA_VOICE_DAILY_CHARS = 8_000;

export const SASA_VOICE_TEST_TEXT = "Oi, eu sou a Sasá. É assim que eu vou te responder.";

export type SasaVoiceOption = { id: string; name: string; language: string | null };

/** O que o navegador recebe: nunca a key, só os 4 últimos caracteres. */
export type SasaVoiceState = {
  allowed: boolean;
  connected: boolean;
  keyLast4: string | null;
  voiceId: string | null;
  voiceName: string | null;
  enabled: boolean;
  usedToday: number;
  dailyLimit: number;
};

export const SASA_VOICE_OFF: SasaVoiceState = { allowed: false, connected: false, keyLast4: null, voiceId: null, voiceName: null, enabled: false, usedToday: 0, dailyLimit: SASA_VOICE_DAILY_CHARS };

export function keyLast4(apiKey: string) {
  return apiKey.trim().slice(-4);
}

/** Dia de São Paulo (o teto diário vira à meia-noite daqui). */
export function saoPauloDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * O texto que vira voz: as falas da Sasá na resposta, sem link nem marcação, cortado no fim de uma frase
 * dentro do teto. Listas, botões e cartões ficam só na tela.
 */
export function sasaVoiceText(blocks: readonly ChatBlock[], max = SASA_VOICE_MAX_CHARS_PER_REPLY): string {
  const text = blocks
    .filter((block): block is Extract<ChatBlock, { type: "assistant" }> => block.type === "assistant")
    .map((block) => block.text)
    .join(" ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clampVoiceText(text, max);
}

export function clampVoiceText(text: string, max = SASA_VOICE_MAX_CHARS_PER_REPLY): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (end > max * 0.4 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max)}…`).trim();
}

/** Quanto ainda cabe hoje; 0 = acabou a cota do dia. */
export function charsLeftToday(usedToday: number, daily = SASA_VOICE_DAILY_CHARS) {
  return Math.max(0, daily - usedToday);
}

/** Voz padrão: a primeira em português do Brasil; sem ela, a primeira em português; sem nenhuma, a primeira. */
export function pickDefaultVoice(voices: readonly SasaVoiceOption[]): SasaVoiceOption | null {
  const lang = (voice: SasaVoiceOption) => (voice.language ?? "").toLowerCase();
  return voices.find((voice) => /pt[-_]br|brazil/.test(lang(voice)))
    ?? voices.find((voice) => /^pt|portug/.test(lang(voice)))
    ?? voices[0]
    ?? null;
}

/** Motivo curto para o corretor quando o ElevenLabs não responde (fica só o texto). */
export function voiceFailureReason(status: number | null): string {
  if (status === 401 || status === 403) return "a key do ElevenLabs foi recusada";
  if (status === 402 || status === 429) return "os créditos ou o limite do ElevenLabs acabaram";
  if (status === 404 || status === 422 || status === 400) return "a voz escolhida não está disponível";
  if (status === null) return "o ElevenLabs demorou para responder";
  return "o ElevenLabs está fora do ar";
}
