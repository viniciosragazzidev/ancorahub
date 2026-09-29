import { describe, expect, it } from "vitest";

import { encodeUnassignedLeadsPdf } from "./unassigned-leads-pdf";

describe("unassigned leads PDF", () => {
  it("creates a structured PDF for the complete list", async () => {
    const bytes = await encodeUnassignedLeadsPdf({
      generatedAt: new Date("2026-09-21T12:00:00.000Z"),
      rows: [
        {
          name: "Lead de teste",
          contact: "+55 21 99999-0000 · teste@example.com",
          lives: "2",
          city: "Nova Iguaçu",
          enteredAt: new Date("2026-09-20T12:00:00.000Z"),
        },
      ],
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(500);
  });
});

