import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";
import { pickVoiceMimeType, voiceClock } from "@/components/chat/voice-recorder";

import { retentionCutoff, sasaLimitMessage, spDayStart, SASA_DAILY_COMMANDS } from "./limits";
import { readSasaFix, sasaFixBlock, undoOf } from "./voice-client";

describe("limites do Sasá", () => {
  it("conta o dia de São Paulo e a retenção de 90 dias", () => {
    expect(spDayStart(new Date("2026-11-20T01:30:00Z")).toISOString()).toBe("2026-11-19T03:00:00.000Z");
    expect(spDayStart(new Date("2026-11-20T04:00:00Z")).toISOString()).toBe("2026-11-20T03:00:00.000Z");
    expect(retentionCutoff(new Date("2026-11-19T12:00:00Z")).toISOString()).toBe("2026-08-21T12:00:00.000Z");
  });

  it("para em 150 pedidos e 20 minutos de áudio", () => {
    expect(sasaLimitMessage({ commands: SASA_DAILY_COMMANDS - 1, audioSeconds: 0 })).toBeNull();
    expect(sasaLimitMessage({ commands: SASA_DAILY_COMMANDS, audioSeconds: 0 })).toContain("150 pedidos");
    expect(sasaLimitMessage({ commands: 10, audioSeconds: 1190 }, { audioSeconds: 5 })).toBeNull();
    expect(sasaLimitMessage({ commands: 10, audioSeconds: 1190 }, { audioSeconds: 15 })).toContain("20 minutos");
  });
});

describe("Corrigir o que eu ouvi", () => {
  const reply: ChatBlock[] = [
    { type: "assistant", id: "a", text: "Combinado." },
    { type: "question", id: "q", prompt: "Foi sem querer?", choices: [{ id: "undo", label: "Desfazer", action: { kind: "server", name: "lead.undoReturn", payload: { taskId: "t1" } } }] },
  ];

  it("leva junto o Desfazer do que foi feito", () => {
    expect(undoOf(reply)).toEqual({ name: "lead.undoReturn", payload: { taskId: "t1" } });
    const block = sasaFixBlock("marca retorno com o Pedro amanhã às 11", reply, "s");
    const choice = block.type === "question" ? block.choices[0]! : null;
    expect(choice?.label).toBe("Corrigir o que eu ouvi");
    const fix = readSasaFix(choice?.action.kind === "local" ? choice.action.value : "");
    expect(fix).toEqual({ text: "marca retorno com o Pedro amanhã às 11", undo: { name: "lead.undoReturn", payload: { taskId: "t1" } } });
  });

  it("sem ação feita, só devolve o texto", () => {
    const block = sasaFixBlock("quem está esperando", [{ type: "assistant", id: "a", text: "Ninguém." }], "s");
    const value = block.type === "question" && block.choices[0]!.action.kind === "local" ? block.choices[0]!.action.value : "";
    expect(readSasaFix(value)).toEqual({ text: "quem está esperando", undo: null });
    expect(readSasaFix("ask:oi")).toBeNull();
  });
});

describe("gravação", () => {
  it("escolhe o formato que o aparelho grava e mostra o tempo", () => {
    expect(pickVoiceMimeType((type) => type === "audio/mp4")).toBe("audio/mp4");
    expect(pickVoiceMimeType((type) => type.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickVoiceMimeType(() => false)).toBeUndefined();
    expect(voiceClock(7_400)).toBe("0:07");
    expect(voiceClock(61_000)).toBe("1:01");
  });
});
