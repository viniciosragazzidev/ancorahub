import { describe, expect, it } from "vitest";

import { integrationCatalogEntries } from "./integrations-catalog";

describe("integration catalog", () => {
  it("exposes only implemented connectors as navigation targets", () => {
    const available = integrationCatalogEntries.filter((entry) => entry.status === "available");
    const planned = integrationCatalogEntries.filter((entry) => entry.status === "planned");

    expect(available.map((entry) => entry.href)).toEqual(expect.arrayContaining([
      "/settings/meta",
      "/settings?tab=integracoes",
    ]));
    expect(planned.every((entry) => entry.href === undefined)).toBe(true);
  });
});
