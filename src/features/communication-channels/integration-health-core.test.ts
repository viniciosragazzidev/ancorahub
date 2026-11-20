import { describe, expect, it } from "vitest";

import { ago, classifyIntegrationHealth } from "./integration-health-core";

const now = new Date("2026-11-20T15:00:00Z");

describe("classifyIntegrationHealth", () => {
  it("recebendo quando o último lead tem até 24 h", () => {
    const health = classifyIntegrationHealth(new Date("2026-11-20T13:00:00Z"), 34, now);
    expect(health).toMatchObject({ state: "receiving", label: "Recebendo leads", detail: "Último lead há 2 h · 34 nas últimas 24 h" });
  });

  it("sem leads há dias quando parou, e sem leads em 30 dias quando nunca chegou", () => {
    expect(classifyIntegrationHealth(new Date("2026-11-17T15:00:00Z"), 0, now)).toMatchObject({ state: "quiet", label: "Sem leads há 3 dias" });
    expect(classifyIntegrationHealth(null, 0, now)).toMatchObject({ state: "silent", label: "Sem leads em 30 dias", lastLeadAt: null });
  });

  it("ago fala em minutos, horas e dias", () => {
    expect(ago(new Date("2026-11-20T14:59:50Z"), now)).toBe("agora");
    expect(ago(new Date("2026-11-20T14:20:00Z"), now)).toBe("há 40 min");
    expect(ago(new Date("2026-11-19T15:00:00Z"), now)).toBe("há 1 dia");
  });
});
