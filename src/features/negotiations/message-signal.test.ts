import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { countsForNegotiationTiming, negotiationTimingSignalSql } from "./message-signal";

const base = { direction: "incoming", body: "[text]", mediaKind: null, messageId: "false_123456789012345@lid_ABC", ownTwinExists: false };

describe("negotiation timing signal", () => {
  it("counts a textless client message: it proves the client wrote", () => {
    expect(countsForNegotiationTiming(base)).toBe(true);
    expect(countsForNegotiationTiming({ ...base, body: "  " })).toBe(true);
  });

  it("does not count the echo of the broker's own message as the client", () => {
    expect(countsForNegotiationTiming({ ...base, ownTwinExists: true })).toBe(false);
  });

  it("keeps ignoring textless broker messages and counts any content", () => {
    expect(countsForNegotiationTiming({ ...base, direction: "outgoing" })).toBe(false);
    expect(countsForNegotiationTiming({ ...base, direction: "outgoing", body: "Bom dia" })).toBe(true);
    expect(countsForNegotiationTiming({ ...base, body: "[text]", mediaKind: "image", ownTwinExists: true })).toBe(true);
  });

  it("builds the same rule in SQL for a fixed alias only", () => {
    const query = new PgDialect().sqlToQuery(negotiationTimingSignalSql("m")).sql;
    expect(query).toContain("m.direction = 'incoming'");
    expect(query).toContain("own_twin.message_id = 'true_' || substr(m.message_id, 7)");
    expect(query).toContain(String.raw`like 'false\_%'`);
    expect(() => negotiationTimingSignalSql("m; drop table x")).toThrow();
  });
});
