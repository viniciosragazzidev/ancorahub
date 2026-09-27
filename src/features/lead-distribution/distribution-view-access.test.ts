import { describe, expect, it } from "vitest";

import { resolveDistributionView, visibleDistributionViews } from "./distribution-view-access";

describe("distribution view access", () => {
  it("keeps queue definition exclusive to directors", () => {
    expect(visibleDistributionViews("director")).toContain("filas");
    expect(visibleDistributionViews("manager")).not.toContain("filas");
    expect(visibleDistributionViews("supervisor")).not.toContain("filas");
  });

  it("does not honor a direct queue-definition URL for managers", () => {
    expect(resolveDistributionView("manager", "filas")).toBe("resumo_dia");
    expect(resolveDistributionView("director", "filas")).toBe("filas");
  });

  it("opens the summary first while retaining deep links", () => {
    expect(resolveDistributionView("director")).toBe("resumo_dia");
    expect(resolveDistributionView("manager", "resumo")).toBe("resumo_dia");
    expect(resolveDistributionView("director", "plantao")).toBe("plantao");
  });
});
