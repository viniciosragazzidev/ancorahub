import { describe, expect, it } from "vitest";

import { guideError, narrationKey, progressOf, resumeStep, visibleStep, type GuideConnectionFacts } from "./presence-guide-steps";

const facts: GuideConnectionFacts = { ready: false, phase: "qr", code: "K7QM2XPD", expired: false, cooldownSeconds: 0, stalled: false, connectivity: null, issue: null };

describe("roteiro de presença: etapa visível", () => {
  it("depois de conectar, mostra a comemoração e depois segue a presença", () => {
    expect(visibleStep({ local: "esperando", device: "mobile", ready: true, stage: "connect" })).toBe("conectado");
    expect(visibleStep({ local: "esperando", device: "mobile", ready: true, stage: "confirm" })).toBe("confirmar");
    expect(visibleStep({ local: "esperando", device: "mobile", ready: true, stage: "sending" })).toBe("confirmar");
    expect(visibleStep({ local: "esperando", device: "mobile", ready: true, stage: "done" })).toBe("pronto");
    expect(visibleStep({ local: "esperando", device: "mobile", ready: true, stage: "waiting" })).toBe("pronto");
  });

  it("no computador, código, tela inicial, caminho e espera são a mesma tela", () => {
    for (const local of ["codigo", "telainicial", "caminho", "esperando"] as const) {
      expect(visibleStep({ local, device: "desktop", ready: false, stage: "connect" })).toBe("codigo");
    }
    expect(visibleStep({ local: "telainicial", device: "mobile", ready: false, stage: "connect" })).toBe("telainicial");
  });
});

describe("roteiro de presença: erros", () => {
  const base = { step: "codigo" as const, device: "mobile" as const, local: null, stage: "connect" as const };
  it("sem problema, nenhum erro", () => expect(guideError({ ...base, facts })).toBeNull());
  it("código vencido, espera e falha ao gerar aparecem quando não há código", () => {
    expect(guideError({ ...base, facts: { ...facts, code: null, expired: true } })).toBe("expired");
    expect(guideError({ ...base, facts: { ...facts, code: null, cooldownSeconds: 12 } })).toBe("cooldown");
    expect(guideError({ ...base, facts: { ...facts, code: null, issue: "x" } })).toBe("issue");
  });
  it("WhatsApp recusou e demora só na espera (ou no computador)", () => {
    expect(guideError({ ...base, facts: { ...facts, phase: "error" } })).toBeNull();
    expect(guideError({ ...base, step: "esperando", facts: { ...facts, phase: "error" } })).toBe("rejected");
    expect(guideError({ ...base, device: "desktop", facts: { ...facts, stalled: true } })).toBe("stalled");
  });
  it("serviço instável vira 'confirmar mesmo assim'", () => {
    expect(guideError({ ...base, step: "caminho", facts: { ...facts, connectivity: "unreachable" } })).toBe("unstable");
  });
  it("erros do navegador valem só nas etapas certas", () => {
    expect(guideError({ ...base, local: "copyBlocked", facts })).toBe("copyBlocked");
    expect(guideError({ ...base, local: "notOpened", facts })).toBeNull();
    expect(guideError({ ...base, step: "telainicial", local: "notOpened", facts })).toBe("notOpened");
  });
  it("falha ao confirmar presença aparece na etapa de confirmar", () => {
    expect(guideError({ ...base, step: "confirmar", stage: "error", facts })).toBe("confirm");
  });
});

describe("roteiro de presença: progresso e retomada", () => {
  it("7 marcos no celular, com a tela inicial no 3; 4 no computador", () => {
    expect(progressOf("telainicial", "mobile")).toMatchObject({ at: 3, total: 7 });
    expect(progressOf("confirmar", "mobile")).toMatchObject({ at: 7, total: 7 });
    expect(progressOf("pronto", "desktop")).toMatchObject({ at: 4, total: 4, fill: 1 });
  });
  it("retoma no código (com um novo) quem já tinha passado dele; lembrança velha não vale", () => {
    const now = Date.now();
    expect(resumeStep({ step: "caminho", platform: "android", at: now - 60_000 }, now)).toBe("codigo");
    expect(resumeStep({ step: "numero", platform: "android", at: now }, now)).toBe("numero");
    expect(resumeStep({ step: "boasvindas", platform: "android", at: now }, now)).toBeNull();
    expect(resumeStep({ step: "caminho", platform: "android", at: now - 3 * 60 * 60_000 }, now)).toBeNull();
    expect(resumeStep(null, now)).toBeNull();
  });
});

describe("roteiro de presença: narração de cada etapa (10/11)", () => {
  const base = { scene: 0, platform: "android" as const, device: "mobile" as const, mode: "presence" as const, method: "code" as const, dutyMode: "online" as const, stage: "connect" as const, error: null };
  it("cada etapa tem a sua narração", () => {
    expect(narrationKey({ ...base, step: "boasvindas" })).toBe("boas-vindas");
    expect(narrationKey({ ...base, step: "codigo" })).toBe("codigo");
    expect(narrationKey({ ...base, step: "telainicial" })).toBe("tela-inicial");
    expect(narrationKey({ ...base, step: "esperando" })).toBe("esperando");
    expect(narrationKey({ ...base, step: "confirmar", stage: "confirm" })).toBe("confirmar");
    expect(narrationKey({ ...base, step: "pronto", stage: "done" })).toBe("pronto");
  });
  it("o caminho narra um toque por vez, com o 1º diferente no iPhone", () => {
    expect(narrationKey({ ...base, step: "caminho", scene: 0 })).toBe("toque-1-android");
    expect(narrationKey({ ...base, step: "caminho", scene: 0, platform: "iphone" })).toBe("toque-1-iphone");
    expect(narrationKey({ ...base, step: "caminho", scene: 3 })).toBe("toque-4");
  });
  it("varia no computador, no presencial e no modo só conectar", () => {
    expect(narrationKey({ ...base, step: "codigo", device: "desktop", method: "qr" })).toBe("codigo-computador-qr");
    expect(narrationKey({ ...base, step: "codigo", device: "desktop" })).toBe("codigo-computador-numero");
    expect(narrationKey({ ...base, step: "confirmar", stage: "confirm", dutyMode: "presencial" })).toBe("confirmar-presencial");
    expect(narrationKey({ ...base, step: "pronto", stage: "waiting" })).toBe("pronto-presencial");
    expect(narrationKey({ ...base, step: "conectado", mode: "connect" })).toBe("conectado-so-conectar");
  });
  it("sem narração com erro na tela ou enquanto confirma", () => {
    expect(narrationKey({ ...base, step: "codigo", error: "expired" })).toBeNull();
    expect(narrationKey({ ...base, step: "confirmar", stage: "sending" })).toBeNull();
  });
});
