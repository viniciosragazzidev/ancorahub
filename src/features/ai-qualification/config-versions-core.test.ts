import { describe, expect, it } from "vitest";

import { changedConfigFields, configSnapshotOf, parseConfigSnapshot, restoreInputFrom, summarizeConfigChange } from "./config-versions-core";

const BASE = {
  enabled: true,
  pauseMode: "handoff_active",
  assistantName: "Ana",
  initialMessage: "Olá!",
  handoffMessage: "Vou chamar o corretor.",
  outOfHoursMessage: "Fora do horário.",
  absenceMessage: "Sem corretor.",
  tone: "friendly",
  useEmojis: false,
  timeoutMinutes: 30,
  businessContext: "Planos PME",
  customInstructions: "Seja cordial.",
  quickReplyCooldownMinutes: 10,
  quickReplyWaitWindowMinutes: 30,
  quickReplyWaitLimitCount: 2,
};

describe("histórico do prompt", () => {
  it("a versão guarda só os campos editáveis e nunca o interruptor da IA", () => {
    const snapshot = configSnapshotOf({ ...BASE, id: "x", tenantId: "t1", version: 4 });
    expect(snapshot).not.toHaveProperty("enabled");
    expect(snapshot).not.toHaveProperty("tenantId");
    expect(snapshot.assistantName).toBe("Ana");
  });

  it("aponta o que mudou entre duas versões, ignorando espaço sobrando e vazio x ausente", () => {
    const before = configSnapshotOf(BASE);
    const after = configSnapshotOf({ ...BASE, assistantName: "Bia", customInstructions: " Seja cordial. ", businessContext: "Planos PME e adesão" });
    expect(changedConfigFields(before, after)).toEqual(["assistantName", "businessContext"]);
    expect(changedConfigFields(configSnapshotOf({ ...BASE, businessContext: null }), configSnapshotOf({ ...BASE, businessContext: "" }))).toEqual([]);
    expect(changedConfigFields(null, after)).toEqual([]);
  });

  it("resume em uma linha, em português", () => {
    expect(summarizeConfigChange({ changed: ["assistantName"] })).toBe("Mudou nome de exibição");
    expect(summarizeConfigChange({ changed: ["assistantName", "customInstructions"] })).toBe("Mudou nome de exibição e diretrizes");
    expect(summarizeConfigChange({ changed: ["quickReplyCooldownMinutes", "quickReplyWaitLimitCount"] })).toBe("Mudou respostas rápidas");
    expect(summarizeConfigChange({ changed: ["assistantName", "tone", "initialMessage", "businessContext", "useEmojis"] })).toBe("Mudou nome de exibição, tom de voz e mensagem inicial e mais 2");
    expect(summarizeConfigChange({ changed: [] })).toBe("Salvou sem mudar os textos");
    expect(summarizeConfigChange({ changed: [], restoredFromVersion: 3 })).toBe("Restaurou a versão 3");
    expect(summarizeConfigChange({ changed: [], first: true })).toBe("Versão de partida");
    expect(summarizeConfigChange({ changed: ["assistantName"] })).not.toContain("—");
  });

  it("restaurar copia os textos da versão antiga e mantém a IA como está", () => {
    const old = configSnapshotOf({ ...BASE, assistantName: "Carla", customInstructions: "" });
    const current = { ...BASE, enabled: false, assistantName: "Bia" };
    const restored = restoreInputFrom(old, current);
    expect(restored.assistantName).toBe("Carla");
    expect(restored.customInstructions).toBe("");
    expect(restored.enabled).toBe(false);
  });

  it("versão antiga sem um campo (gravada antes dele existir) não apaga o valor atual", () => {
    const old = parseConfigSnapshot({ assistantName: "Carla" });
    const restored = restoreInputFrom(old, BASE);
    expect(restored.assistantName).toBe("Carla");
    expect(restored.initialMessage).toBe("Olá!");
    expect(parseConfigSnapshot("lixo")).toEqual({});
  });
});
