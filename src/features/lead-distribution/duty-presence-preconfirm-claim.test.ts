import { describe, expect, it } from "vitest";

import { claimDutyPresencePreconfirmation } from "./duty-presence-preconfirm-claim";

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

describe("claimDutyPresencePreconfirmation", () => {
  it("duas chamadas simultâneas atualizam uma única ocorrência pendente", async () => {
    const state = { status: "pending" as string | null };
    let sideEffects = 0;
    const barrier = createBarrier(2);
    const tx = {
      insert: () => ({ values: () => ({ onConflictDoNothing: async () => [] }) }),
      update: () => ({
        set: (values: { status: string }) => ({
          where: () => ({
            returning: async () => {
              await barrier();
              if (state.status !== "pending") return [];
              state.status = values.status;
              sideEffects += 1;
              return [{ id: "confirmation-1" }];
            },
          }),
        }),
      }),
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ status: state.status }] }) }) }),
    };
    const input = {
      tenantId: "tenant-1", scheduleId: "schedule-next", assignmentId: "assignment-next", brokerId: "broker-1",
      dutyDate: "2026-11-16", startsAt: new Date("2026-11-16T16:00:00.000Z"), endsAt: new Date("2026-11-16T20:00:00.000Z"),
      actorId: "director-1", now: new Date("2026-11-16T15:00:00.000Z"),
    };

    const results = await Promise.all([
      claimDutyPresencePreconfirmation(tx as never, input),
      claimDutyPresencePreconfirmation(tx as never, input),
    ]);
    expect(results.filter((result) => result.kind === "claimed")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "already_confirmed")).toHaveLength(1);
    expect(sideEffects).toBe(1);
  });
});
