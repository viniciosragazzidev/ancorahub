import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { schema } from "@/shared/db";
import { loadedLeadMessageScope } from "./loaded-lead-message-scope";

describe("loadedLeadMessageScope", () => {
  it("loads selected lead IDs and unlinked messages that match their phone", () => {
    const query = new PgDialect().sqlToQuery(loadedLeadMessageScope({
      message: schema.whatsappMessages,
      leads: [
        { id: "lead-1", phone: "+55 (11) 99999-1234" },
        { id: "lead-2", phone: "5511987654321" },
      ],
    }));

    expect(query.sql).toContain('"whatsapp_messages"."lead_id" in');
    expect(query.sql).toContain('"whatsapp_messages"."lead_id" is null');
    expect(query.sql).toContain("right(regexp_replace(coalesce(");
    expect(query.params).toEqual(expect.arrayContaining(["lead-1", "lead-2", "99991234", "87654321"]));
  });

  it("fails closed when the visible leads have no usable IDs or phones", () => {
    const query = new PgDialect().sqlToQuery(loadedLeadMessageScope({ message: schema.whatsappMessages, leads: [] }));
    expect(query.sql).toBe("false");
  });
});
