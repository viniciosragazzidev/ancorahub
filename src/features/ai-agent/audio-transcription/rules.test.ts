import { describe, expect, it } from "vitest";

import { opusOggFixture, vorbisOggFixture } from "./ogg-fixture";
import {
  AUDIO_DECLINE_TEXTS,
  AUDIO_TRANSCRIPT_MAX_CHARS,
  cleanTranscript,
  estimateTranscriptionCostUsd,
  isAudioDeclineText,
  isAudioWithinLimit,
  isLeadInQualificationForAudio,
  nextAudioSlot,
  readOggDurationSeconds,
} from "./rules";

const qualifying = { conversationStatus: "AI_ACTIVE", automationState: "AI_ACTIVE", qualificationStatus: "qualifying", distributionStatus: "unassigned", corretorId: null };

describe("lead em qualificação para áudio", () => {
  it("aceita lead pendente ou qualificando com a IA conduzindo", () => {
    expect(isLeadInQualificationForAudio(qualifying)).toBe(true);
    expect(isLeadInQualificationForAudio({ ...qualifying, conversationStatus: "NEW", qualificationStatus: "pending" })).toBe(true);
    expect(isLeadInQualificationForAudio({ ...qualifying, conversationStatus: "WAITING_CUSTOMER", automationState: null })).toBe(true);
  });

  it.each([
    ["qualificado", { qualificationStatus: "qualified" }],
    ["quente", { qualificationStatus: "hot" }],
    ["frio", { qualificationStatus: "cold" }],
    ["desqualificado", { qualificationStatus: "disqualified" }],
    ["aguardando humano", { conversationStatus: "WAITING_HUMAN" }],
    ["humano assumiu", { conversationStatus: "HUMAN_ACTIVE" }],
    ["conversa encerrada", { conversationStatus: "CLOSED" }],
    ["pausada", { conversationStatus: "PAUSED" }],
    ["automação fora da IA", { automationState: "HUMAN_IN_PROGRESS" }],
    ["segurado pelo diretor", { distributionStatus: "manual_hold" }],
    ["já com corretor", { corretorId: "user-1" }],
    ["turno só de correção", { correctionOnly: true }],
  ])("recusa lead %s", (_label, patch) => {
    expect(isLeadInQualificationForAudio({ ...qualifying, ...patch })).toBe(false);
  });
});

describe("vez do áudio", () => {
  it("dá a vez 1, depois a 2, e nenhuma a partir do terceiro", () => {
    expect(nextAudioSlot([])).toBe(1);
    expect(nextAudioSlot([1])).toBe(2);
    expect(nextAudioSlot([2])).toBe(1);
    expect(nextAudioSlot([1, 2])).toBeNull();
  });
});

describe("duração do áudio", () => {
  it("lê a duração de uma nota de voz Opus", () => {
    expect(readOggDurationSeconds(opusOggFixture(37.5))).toBeCloseTo(37.5, 1);
    expect(readOggDurationSeconds(opusOggFixture(121))).toBeCloseTo(121, 1);
  });

  it("lê a duração de um OGG Vorbis", () => {
    expect(readOggDurationSeconds(vorbisOggFixture(15))).toBeCloseTo(15, 1);
  });

  it("devolve null para o que não é OGG", () => {
    expect(readOggDurationSeconds(new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0]))).toBeNull();
    expect(readOggDurationSeconds(new Uint8Array(0))).toBeNull();
  });

  it("aceita até 2 minutos; sem duração, até 2 MB", () => {
    expect(isAudioWithinLimit({ durationSeconds: 120, sizeBytes: 999_999_999 })).toBe(true);
    expect(isAudioWithinLimit({ durationSeconds: 120.5, sizeBytes: 10 })).toBe(false);
    expect(isAudioWithinLimit({ durationSeconds: null, sizeBytes: 2 * 1024 * 1024 })).toBe(true);
    expect(isAudioWithinLimit({ durationSeconds: null, sizeBytes: 2 * 1024 * 1024 + 1 })).toBe(false);
  });
});

describe("custo e texto", () => {
  it("estima o custo com o mínimo de 10 s do Groq", () => {
    expect(estimateTranscriptionCostUsd("groq", 3)).toBeCloseTo((10 / 60) * (0.04 / 60), 6);
    expect(estimateTranscriptionCostUsd("groq", 60)).toBeCloseTo(0.04 / 60, 6);
    expect(estimateTranscriptionCostUsd("openai", 60)).toBeCloseTo(0.003, 6);
    expect(estimateTranscriptionCostUsd("openai", null)).toBeNull();
  });

  it("limpa espaços e corta texto muito longo", () => {
    expect(cleanTranscript("  oi,\n  tudo bem?  ")).toBe("oi, tudo bem?");
    expect(cleanTranscript(null)).toBe("");
    expect(cleanTranscript("a".repeat(AUDIO_TRANSCRIPT_MAX_CHARS + 50))).toHaveLength(AUDIO_TRANSCRIPT_MAX_CHARS);
  });

  it("reconhece o próprio pedido para escrever (não repete)", () => {
    for (const text of Object.values(AUDIO_DECLINE_TEXTS)) {
      expect(isAudioDeclineText(text)).toBe(true);
      expect(text).toMatch(/por escrito, por favor\?$/);
    }
    expect(isAudioDeclineText("Qual a sua idade?")).toBe(false);
  });
});
