import { describe, expect, it } from "vitest";

import { conversationDayGroup } from "./conversation-day-group";

describe("conversationDayGroup", () => {
  const now = new Date(2026, 10, 21, 15, 0);
  it("separa hoje, ontem, esta semana e mais antigas", () => {
    expect(conversationDayGroup(new Date(2026, 10, 21, 8, 0).toISOString(), now)).toBe("Hoje");
    expect(conversationDayGroup(new Date(2026, 10, 20, 23, 0).toISOString(), now)).toBe("Ontem");
    expect(conversationDayGroup(new Date(2026, 10, 16, 9, 0).toISOString(), now)).toBe("Esta semana");
    expect(conversationDayGroup(new Date(2026, 10, 14, 9, 0).toISOString(), now)).toBe("Mais antigas");
  });
  it("sem data ou data inválida não cria grupo", () => {
    expect(conversationDayGroup(null, now)).toBeNull();
    expect(conversationDayGroup("x", now)).toBeNull();
  });
});
