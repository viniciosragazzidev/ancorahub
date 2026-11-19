import { describe, expect, it } from "vitest";

import { claimLeadForInvestigation } from "./investigation-claim";

describe("claimLeadForInvestigation", () => {
  it("permits only one of two simultaneous claims against the same lead snapshot", async () => {
    const state = { ownerId: null as string | null, status: "new" };
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tx = {
      update: () => {
        let assignedOwner: string | null = null;
        return {
          set: (values: { corretorId: string | null }) => {
            assignedOwner = values.corretorId;
            return {
              where: () => ({
                returning: async () => {
                  arrived += 1;
                  if (arrived === 2) release();
                  await gate;
                  if (state.ownerId !== null || state.status !== "new") return [];
                  state.ownerId = assignedOwner;
                  state.status = "under_analysis";
                  return [{ id: "lead-1", branchId: "unit-1" }];
                },
              }),
            };
          },
        };
      },
    };
    const expected = { id: "lead-1", tenantId: "tenant-1", status: "new" as const, corretorId: null, branchId: "unit-1" };
    const results = await Promise.all([
      claimLeadForInvestigation(tx as never, { expected, actorId: "broker-a", now: new Date() }),
      claimLeadForInvestigation(tx as never, { expected, actorId: "broker-b", now: new Date() }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(state.status).toBe("under_analysis");
    expect(["broker-a", "broker-b"]).toContain(state.ownerId);
  });
});
