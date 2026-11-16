import { describe, expect, it } from "vitest";

import { claimDutyPresencePreconfirmation } from "./duty-presence-preconfirm-claim";
import { saveOwnDutyPresenceAnswer } from "./duty-presence-self-confirm";

function createBarrier(parties: number) {
  let arrived = 0;
  let release!: () => void;
  const open = new Promise<void>((resolve) => { release = resolve; });
  return async () => {
    arrived += 1;
    if (arrived === parties) release();
    await open;
  };
}

describe("self confirmation against preconfirmation", () => {
  it("broker confirmation and management preconfirmation cannot overwrite each other", async () => {
    const state = { status: "pending" as string, confirmedBy: null as string | null };
    const barrier = createBarrier(2);
    const tx = {
      insert: () => ({
        values: () => ({
          onConflictDoNothing: async () => [],
          onConflictDoUpdate: () => ({
            returning: async () => {
              await barrier();
              if (state.status === "absent" || state.status === "confirmed") return [];
              state.status = "confirmed";
              state.confirmedBy = null;
              return [{ id: "confirmation-1" }];
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: { status: string; confirmedBy: string }) => ({
          where: () => ({
            returning: async () => {
              await barrier();
              if (state.status !== "pending") return [];
              state.status = values.status;
              state.confirmedBy = values.confirmedBy;
              return [{ id: "confirmation-1" }];
            },
          }),
        }),
      }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "confirmation-1", status: state.status, confirmedBy: state.confirmedBy }] }) }) }),
    };
    const common = {
      tenantId: "tenant-1", scheduleId: "schedule-1", assignmentId: "assignment-1", brokerId: "broker-1",
      dutyDate: "2026-11-16", startsAt: new Date("2026-11-16T16:00:00.000Z"), endsAt: new Date("2026-11-16T20:00:00.000Z"), now: new Date("2026-11-16T15:00:00.000Z"),
    };

    const results = await Promise.all([
      claimDutyPresencePreconfirmation(tx as never, { ...common, actorId: "director-1" }),
      saveOwnDutyPresenceAnswer(tx as never, {
        ...common,
        answer: { status: "confirmed", confirmedAt: common.now, confirmedBy: null, photoStorageKey: null, photoTakenAt: null, updatedAt: common.now },
      }),
    ]);
    const writes = results.filter((result) => result.kind === "claimed" || result.kind === "saved");
    expect(writes).toHaveLength(1);
    expect(state.status).toBe("confirmed");
    expect([null, "director-1"]).toContain(state.confirmedBy);
  });
});
