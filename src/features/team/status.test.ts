import { describe, expect, it } from "vitest";

import { normalizeTeamMemberStatus, teamMemberStatusLabels } from "./status";

describe("team member status contract", () => {
  it("normalizes legacy and unknown values without exposing database labels", () => {
    expect(normalizeTeamMemberStatus("active")).toBe("active");
    expect(normalizeTeamMemberStatus("pending")).toBe("pending");
    expect(normalizeTeamMemberStatus("inactive")).toBe("disabled");
    expect(normalizeTeamMemberStatus("disabled")).toBe("disabled");
    expect(normalizeTeamMemberStatus(undefined)).toBe("disabled");
  });

  it("uses the customer-facing disabled label", () => {
    expect(teamMemberStatusLabels.disabled).toBe("Desativado");
  });
});
