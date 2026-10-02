import { describe, expect, it } from "vitest";

import { assignmentShift, dutyShifts, retimeAssignmentForSplit, validShiftSplit, worksInShift } from "./duty-shifts";
import { getDutyLeadShift, groupDutyLeadsByShift } from "./duty-leads-shift-groups";

const plantao = { startsAt: "09:00", endsAt: "18:00", shiftSplitAt: "13:30" };

describe("plantão split in shifts (09:00–18:00 at 13:30)", () => {
  it("has a morning, an afternoon and the whole day", () => {
    expect(dutyShifts(plantao)).toEqual([
      { key: "manha", label: "Manhã · 09:00–13:30", startsAt: "09:00", endsAt: "13:30" },
      { key: "tarde", label: "Tarde · 13:30–18:00", startsAt: "13:30", endsAt: "18:00" },
      { key: "dia", label: "Dia todo · 09:00–18:00", startsAt: "09:00", endsAt: "18:00" },
    ]);
    expect(dutyShifts({ ...plantao, shiftSplitAt: null })).toBeNull();
    expect(validShiftSplit(plantao, "19:00")).toBeNull();
  });

  it("knows each broker's shift from their roster window", () => {
    expect(assignmentShift(plantao, { startsAt: "09:00", endsAt: "13:30" })).toBe("manha");
    expect(assignmentShift(plantao, { startsAt: "13:30:00", endsAt: "18:00:00" })).toBe("tarde");
    expect(assignmentShift(plantao, { startsAt: "09:00", endsAt: "18:00" })).toBe("dia");
    expect(worksInShift("dia", "tarde")).toBe(true);
    expect(worksInShift("manha", "tarde")).toBe(false);
  });

  it("moving the split keeps morning brokers in the morning and afternoon ones in the afternoon", () => {
    expect(retimeAssignmentForSplit(plantao, "13:30", "14:00", { startsAt: "09:00", endsAt: "13:30" })).toEqual({ startsAt: "09:00", endsAt: "14:00" });
    expect(retimeAssignmentForSplit(plantao, "13:30", "14:00", { startsAt: "13:30", endsAt: "18:00" })).toEqual({ startsAt: "14:00", endsAt: "18:00" });
    expect(retimeAssignmentForSplit(plantao, "13:30", null, { startsAt: "13:30", endsAt: "18:00" })).toEqual({ startsAt: "09:00", endsAt: "18:00" });
    expect(retimeAssignmentForSplit(plantao, "13:30", "14:00", { startsAt: "09:00", endsAt: "18:00" })).toBeNull();
  });

  it("splits the plantão's leads at 13:30, also for a plantão with one shift", () => {
    const at = (iso: string) => ({ assignedAt: new Date(iso), corretorId: "b1", createdAt: new Date(iso) });
    expect(getDutyLeadShift(at("2026-10-02T16:15:00Z"), "13:30")).toBe("manha"); // 13:15 Brasília
    expect(getDutyLeadShift(at("2026-10-02T16:45:00Z"), "13:30")).toBe("tarde"); // 13:45
    expect(getDutyLeadShift(at("2026-10-02T16:15:00Z"))).toBe("manha");
    expect(getDutyLeadShift(at("2026-10-02T16:30:00Z"))).toBe("tarde");
    expect(groupDutyLeadsByShift([at("2026-10-02T16:45:00Z")], "13:30")[0]!.label).toBe("Tarde · a partir de 13:30");
  });
});
