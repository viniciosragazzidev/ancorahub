import { describe, expect, it } from "vitest";

import { coldReleaseAt, isColdLeadsQueueName, isColdReleased } from "./cold-age-release-rules";

const sp = (value: string) => new Date(`${value}-03:00`);

describe("Leads Frios: liberação com 2 dias, às 9h", () => {
  it("em 23/10 às 9h libera os frios de 21/10 para trás", () => {
    const now = sp("2026-10-23T09:00:00");
    expect(isColdReleased(sp("2026-10-21T23:50:00"), now)).toBe(true);
    expect(isColdReleased(sp("2026-10-20T10:00:00"), now)).toBe(true);
    expect(isColdReleased(sp("2026-10-22T00:10:00"), now)).toBe(false);
  });

  it("antes das 9h ainda vale a liberação de ontem", () => {
    const now = sp("2026-10-23T08:30:00");
    expect(isColdReleased(sp("2026-10-20T15:00:00"), now)).toBe(true);
    expect(isColdReleased(sp("2026-10-21T15:00:00"), now)).toBe(false);
  });

  it("Liberar agora antecipa a liberação de hoje", () => {
    const now = sp("2026-10-23T08:30:00");
    expect(isColdReleased(sp("2026-10-21T15:00:00"), now, true)).toBe(true);
    expect(isColdReleased(sp("2026-10-22T15:00:00"), now, true)).toBe(false);
  });

  it("o lead volta para a distribuição às 9h do dia em que completa 2 dias", () => {
    expect(coldReleaseAt(sp("2026-10-21T22:40:00")).toISOString()).toBe(sp("2026-10-23T09:00:00").toISOString());
  });

  it("vale por padrão na fila chamada Leads Frios", () => {
    expect(isColdLeadsQueueName("Leads Frios")).toBe(true);
    expect(isColdLeadsQueueName("LEADS FRIOS")).toBe(true);
    expect(isColdLeadsQueueName("FILA TATIANA")).toBe(false);
  });
});
