// @vitest-environment jsdom
import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatBlock } from "@/components/chat/types";

const KEY = "chave-de-teste-elevenlabs-0123WXYZ";
const VINICIOS = "ebed87f7-b4f3-41c1-8e92-d234fa5a1ce1";
const DIRETOR = "diretor-1";

// Banco de mentira: só a tabela system_settings, por chave.
const rows = new Map<string, string>();
const session = { tenantId: "t1", userId: VINICIOS, role: "broker" as string, jobTitle: null };
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => session }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: async () => undefined }));
vi.mock("@/shared/db", () => {
  const keyOf = (condition: unknown) => (condition as { value: string }).value;
  return {
    schema: { systemSettings: { key: "key", value: "value" } },
    getDatabase: () => ({
      select: () => ({ from: () => ({ where: (condition: unknown) => ({ limit: async () => { const value = rows.get(keyOf(condition)); return value === undefined ? [] : [{ value }]; } }) }) }),
      insert: () => ({ values: (row: { key: string; value: string }) => ({ onConflictDoUpdate: async () => { rows.set(row.key, row.value); } }) }),
      delete: () => ({ where: async (condition: unknown) => { rows.delete(keyOf(condition)); } }),
    }),
  };
});
vi.mock("drizzle-orm", () => ({ eq: (_column: unknown, value: string) => ({ value }) }));

import { connectSasaVoiceAction, disconnectSasaVoiceAction, getSasaVoiceStateAction, setSasaVoiceEnabledAction } from "./actions";
import { resetSasaVoiceForTests, speakSasaReply, type SasaVoiceBackend } from "./client";
import { ElevenLabsError, listElevenLabsVoices, streamElevenLabsSpeech } from "./elevenlabs";
import { clampVoiceText, isElderlyMaleVoice, isSasaVoicePilot, orderVoices, pickDefaultVoice, sasaVoiceText, SASA_VOICE_MAX_CHARS_PER_REPLY, type SasaVoiceState } from "./rules";

const say = (text: string): ChatBlock => ({ type: "assistant", id: text, text });

beforeEach(() => {
  rows.clear();
  Object.assign(session, { userId: DIRETOR, role: "director" });
  process.env.SASA_VOICE_KEY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});
afterEach(() => { vi.unstubAllGlobals(); resetSasaVoiceForTests(); });

function elevenLabsOk() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ voices: [{ voice_id: "en-1", name: "Rachel", labels: { language: "en" } }, { voice_id: "pt-1", name: "Ana", labels: { accent: "brazilian" } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const asBroker = (userId = VINICIOS) => Object.assign(session, { userId, role: "broker" });
const asDirector = () => Object.assign(session, { userId: DIRETOR, role: "director" });

describe("liberação: o diretor conecta, só o corretor Vinicios Ragazzi ouve", () => {
  it("só ele, e só como corretor", () => {
    expect(isSasaVoicePilot("broker", VINICIOS)).toBe(true);
    expect(isSasaVoicePilot("director", VINICIOS)).toBe(false);
    expect(isSasaVoicePilot("broker", "outro-corretor")).toBe(false);
    expect(isSasaVoicePilot("broker", "outro-corretor", "a, outro-corretor")).toBe(true);
  });

  it("outro corretor recebe tudo desligado e não consegue conectar", async () => {
    asBroker("outro-corretor");
    expect(await getSasaVoiceStateAction()).toMatchObject({ allowed: false, connected: false });
    const fetchMock = elevenLabsOk();
    expect(await connectSasaVoiceAction(KEY)).toEqual({ ok: false, error: "Só o diretor conecta e configura a voz do Sasá." });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(rows.size).toBe(0);
  });

  it("o corretor do teste não conecta: só ouve e liga ou desliga para ele", async () => {
    asBroker();
    elevenLabsOk();
    expect(await connectSasaVoiceAction(KEY)).toEqual({ ok: false, error: "Só o diretor conecta e configura a voz do Sasá." });
    asDirector();
    await connectSasaVoiceAction(KEY);
    asBroker();
    const state = await getSasaVoiceStateAction();
    expect(state).toMatchObject({ allowed: true, canManage: false, connected: true, companyEnabled: true, enabled: true, keyLast4: "WXYZ" });
    expect(JSON.stringify(state)).not.toContain(KEY);
    const off = await setSasaVoiceEnabledAction(false);
    expect(off).toMatchObject({ ok: true, state: { enabled: false, companyEnabled: true } });
    // Desligar para ele não desliga para a empresa.
    asDirector();
    expect(await getSasaVoiceStateAction()).toMatchObject({ canManage: true, enabled: true });
  });

  it("diretor desligou: o corretor não ouve mesmo com a preferência ligada", async () => {
    elevenLabsOk();
    await connectSasaVoiceAction(KEY);
    await setSasaVoiceEnabledAction(false);
    asBroker();
    expect(await getSasaVoiceStateAction()).toMatchObject({ companyEnabled: false, enabled: false });
  });
});

describe("a key nunca vaza", () => {
  it("conecta, guarda criptografada e devolve só os 4 últimos", async () => {
    const fetchMock = elevenLabsOk();
    const result = await connectSasaVoiceAction(KEY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toMatchObject({ connected: true, keyLast4: "WXYZ", voiceId: "pt-1", voiceName: "Ana", enabled: true });
    expect(JSON.stringify(result)).not.toContain(KEY);
    // No banco: só o texto cifrado.
    expect([...rows.values()].join("")).not.toContain(KEY);
    // A key só vai no cabeçalho do ElevenLabs.
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe(KEY);
    // Estado lido de novo: nada da key nem do cifrado.
    const state = await getSasaVoiceStateAction();
    expect(JSON.stringify(state)).not.toContain(KEY);
    expect(Object.keys(state)).not.toContain("keyCiphertext");
  });

  it("erro do ElevenLabs não carrega a key nem o corpo da resposta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`invalid key ${KEY}`, { status: 401 })));
    const error = await listElevenLabsVoices(KEY).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ElevenLabsError);
    expect(String((error as Error).message)).not.toContain(KEY);
    const result = await connectSasaVoiceAction(KEY);
    expect(result).toEqual({ ok: false, error: "Não consegui falar com o ElevenLabs: a key do ElevenLabs foi recusada." });
    expect(rows.size).toBe(0);
  });

  it("desconectar apaga a key", async () => {
    elevenLabsOk();
    await connectSasaVoiceAction(KEY);
    expect(rows.size).toBe(1);
    const result = await disconnectSasaVoiceAction();
    expect(result).toMatchObject({ ok: true, state: { connected: false, keyLast4: null } });
    expect(rows.size).toBe(0);
  });
});

describe("texto da voz e voz padrão", () => {
  it("só as falas do Sasá, sem link, dentro do teto", () => {
    expect(sasaVoiceText([say("Pronto, marquei."), { type: "question", id: "q", prompt: "Quer mais?", choices: [] }, say("Veja https://exemplo.com")])).toBe("Pronto, marquei. Veja");
    const long = "Frase curta. ".repeat(80);
    expect(clampVoiceText(long).length).toBeLessThanOrEqual(SASA_VOICE_MAX_CHARS_PER_REPLY);
  });

  it("sem voz idosa na conta, escolhe a pt-BR", () => {
    expect(pickDefaultVoice([{ id: "a", name: "A", language: "en" }, { id: "b", name: "B", language: "pt-BR" }])?.id).toBe("b");
  });

  it("padrão é o senhor idoso: pt-BR primeiro, depois o idoso de qualquer sotaque", () => {
    const voices = [
      { id: "ana", name: "Ana", language: "pt-BR", gender: "female", age: "young" },
      { id: "bill", name: "Bill", language: "en", gender: "male", age: "old", accent: "american" },
      { id: "antonio", name: "Antônio", language: "pt-BR", gender: "male", age: "old", accent: "brazilian" },
      { id: "dona", name: "Dona", language: "en", gender: "female", age: "old" },
    ];
    expect(pickDefaultVoice(voices)?.id).toBe("antonio");
    expect(pickDefaultVoice(voices.filter((voice) => voice.id !== "antonio"))?.id).toBe("bill");
    expect(isElderlyMaleVoice(voices[3]!)).toBe(false);
    expect(orderVoices(voices, "ana").map((voice) => voice.id)).toEqual(["ana", "bill", "antonio", "dona"]);
  });

  it("fala com o modelo multilíngue, mais estável e um pouco mais lenta", async () => {
    const fetchMock = vi.fn(async () => new Response("mp3", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await streamElevenLabsSpeech(KEY, "bill", "Oi");
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toMatchObject({ model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.65, speed: 0.9 } });
  });

  it("conectar escolhe o senhor idoso da conta", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ voices: [{ voice_id: "ana", name: "Ana", labels: { accent: "brazilian", gender: "female" } }, { voice_id: "bill", name: "Bill", labels: { gender: "male", age: "old", accent: "american" } }] }), { status: 200 })));
    const result = await connectSasaVoiceAction(KEY);
    expect(result.ok && result.state.voiceId).toBe("bill");
  });
});

describe("falha do ElevenLabs: fica só o texto", () => {
  const on: SasaVoiceState = { allowed: true, canManage: false, companyEnabled: true, connected: true, keyLast4: "WXYZ", voiceId: "pt-1", voiceName: "Ana", enabled: true, usedToday: 0, dailyLimit: 8000 };
  const backend = (speak: SasaVoiceBackend["speak"], state = on): SasaVoiceBackend => ({
    state: async () => state, connect: vi.fn(), voices: vi.fn(), choose: vi.fn(), setEnabled: vi.fn(), disconnect: vi.fn(), speak,
  });

  it("devolve o motivo curto e não toca nada", async () => {
    const speak = vi.fn(async () => ({ ok: false as const, reason: "os créditos ou o limite do ElevenLabs acabaram" }));
    const blocks = [say("Pronto, marquei o retorno.")];
    const result = await speakSasaReply(backend(speak), blocks);
    expect(result).toEqual({ spoke: false, reason: "os créditos ou o limite do ElevenLabs acabaram" });
    expect(speak).toHaveBeenCalledWith({ text: "Pronto, marquei o retorno." });
    // Os blocos (o texto) não mudam.
    expect(blocks).toEqual([say("Pronto, marquei o retorno.")]);
  });

  it("voz desligada ou não conectada: nem chama o servidor", async () => {
    const speak = vi.fn();
    expect(await speakSasaReply(backend(speak, { ...on, enabled: false }), [say("Oi")])).toEqual({ spoke: false, reason: null });
    resetSasaVoiceForTests();
    expect(await speakSasaReply(backend(speak, { ...on, connected: false }), [say("Oi")])).toEqual({ spoke: false, reason: null });
    expect(speak).not.toHaveBeenCalled();
  });

  it("som do app desligado: não gera a voz", async () => {
    window.localStorage.setItem("ancora:a11y", JSON.stringify({ sound: false }));
    const speak = vi.fn();
    expect((await speakSasaReply(backend(speak), [say("Oi")])).reason).toBe("o som do app está desligado");
    expect(speak).not.toHaveBeenCalled();
    window.localStorage.clear();
  });
});
