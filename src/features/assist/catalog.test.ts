import { describe, expect, it } from "vitest";

import { helpForRoute, normalize, searchAssist } from "./catalog";

describe("assist catalog", () => {
  it("normalizes accents, case and spaces", () => {
    expect(normalize("  Cotação   Rápida ")).toBe("cotacao rapida");
  });

  it("finds an action by the words a broker uses", () => {
    expect(searchAssist("sumir da fila")[0]?.id).toBe("pause");
    expect(searchAssist("zap")[0]?.id).toBe("whatsapp");
    expect(searchAssist("plantão", { dutyCalendar: true })[0]?.id).toBe("duty");
  });

  it("hides entries behind a capability the user does not have", () => {
    expect(searchAssist("pontos").some((entry) => entry.id === "journey")).toBe(false);
    expect(searchAssist("pontos", { journey: true })[0]?.id).toBe("journey");
  });

  it("lists the screens when the query is empty", () => {
    const results = searchAssist("");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((entry) => entry.kind === "screen")).toBe(true);
  });

  it("returns nothing for gibberish", () => {
    expect(searchAssist("qwzx")).toEqual([]);
  });

  it("picks the most specific help for a route", () => {
    expect(helpForRoute("/leads/abc")?.title).toBe("Lead");
    expect(helpForRoute("/leads")?.title).toBe("Meus leads");
    expect(helpForRoute("/dashboard")?.title).toBe("Início");
    expect(helpForRoute("/jornada#extrato")?.title).toBe("Minha jornada");
    expect(helpForRoute("/cotacao")).toBeNull();
  });
});

describe("bestAssistMatch", () => {
  it("answers a where question with one confident entry", async () => {
    const { bestAssistMatch } = await import("./catalog");
    expect(bestAssistMatch("como faço pra pausar?")?.id).toBe("pause");
    expect(bestAssistMatch("onde troco minha senha")?.id).toBe("password");
    expect(bestAssistMatch("cadê meus pontos?", { journey: true })?.id).toBe("journey");
  });

  it("stays quiet when unsure or too short", async () => {
    const { bestAssistMatch } = await import("./catalog");
    expect(bestAssistMatch("oi")).toBeNull();
    expect(bestAssistMatch("qual o sentido da vida")).toBeNull();
  });
});
