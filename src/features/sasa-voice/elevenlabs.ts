import "server-only";

import { SASA_VOICE_SETTINGS, SASA_VOICE_TEST_TEXT, type SasaVoiceOption } from "./rules";

/**
 * Cliente mínimo do ElevenLabs (Voz do Sasá, teste de 23/11). A key só entra no cabeçalho `xi-api-key`; nenhum
 * erro, log ou retorno carrega a key ou o corpo da resposta do ElevenLabs, só o status HTTP.
 */
const BASE = "https://api.elevenlabs.io/v1";
/** Multilíngue v2: qualquer voz da conta (inclusive o senhor idoso em inglês) fala português pelo texto. */
export const SASA_VOICE_MODEL = "eleven_multilingual_v2";

export class ElevenLabsError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? "ElevenLabs sem resposta" : `ElevenLabs respondeu ${status}`);
    this.name = "ElevenLabsError";
  }
}

type RawVoice = { voice_id?: unknown; name?: unknown; labels?: Record<string, unknown> | null; verified_languages?: Array<{ language?: unknown; locale?: unknown; accent?: unknown }> | null };

function languageOf(voice: RawVoice): string | null {
  const verified = (voice.verified_languages ?? []).find((item) => typeof item.language === "string" && item.language.toLowerCase().startsWith("pt"));
  if (verified) return [verified.locale, verified.language, verified.accent].find((value): value is string => typeof value === "string" && /pt[-_]br|brazil/i.test(value)) ?? String(verified.locale ?? verified.language);
  const labels = voice.labels ?? {};
  const accent = typeof labels.accent === "string" ? labels.accent : "";
  const language = typeof labels.language === "string" ? labels.language : "";
  if (/brazil/i.test(accent)) return "pt-BR";
  return language || accent || null;
}

async function call(apiKey: string, path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), "xi-api-key": apiKey },
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
      cache: "no-store",
    });
  } catch {
    throw new ElevenLabsError(null);
  }
  if (!response.ok) {
    // Descarta o corpo sem ler para log: ele pode ecoar dados da conta.
    await response.body?.cancel().catch(() => undefined);
    throw new ElevenLabsError(response.status);
  }
  return response;
}

/** Vozes da conta (também serve para validar a key ao conectar). */
export async function listElevenLabsVoices(apiKey: string): Promise<SasaVoiceOption[]> {
  const response = await call(apiKey, "/voices", { method: "GET", timeoutMs: 10_000 });
  const data = (await response.json().catch(() => ({}))) as { voices?: RawVoice[] };
  return (data.voices ?? [])
    .filter((voice): voice is RawVoice & { voice_id: string; name: string } => typeof voice.voice_id === "string" && typeof voice.name === "string")
    .map((voice) => {
      const label = (key: string) => (typeof voice.labels?.[key] === "string" ? String(voice.labels[key]).slice(0, 40) : null);
      return { id: voice.voice_id, name: voice.name.slice(0, 80), language: languageOf(voice), gender: label("gender"), age: label("age"), accent: label("accent") };
    });
}

/** Fala o texto em MP3 por streaming: devolve o corpo da resposta para a rota repassar sem esperar o fim. */
export async function streamElevenLabsSpeech(apiKey: string, voiceId: string, text: string = SASA_VOICE_TEST_TEXT): Promise<ReadableStream<Uint8Array>> {
  const response = await call(apiKey, `/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: SASA_VOICE_MODEL, voice_settings: SASA_VOICE_SETTINGS }),
    timeoutMs: 20_000,
  });
  if (!response.body) throw new ElevenLabsError(null);
  return response.body;
}
