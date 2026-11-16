import { describe, expect, it } from "vitest";

import { moveWeeklyRosterAssignment } from "./roster-assignment-move";

describe("moveWeeklyRosterAssignment", () => {
  it("moves only once when two concurrent requests target the same source row", async () => {
    const state = { scheduleId: "schedule-source", dayOfWeek: 1, startsAt: "09:00", endsAt: "13:00", status: "active" };
    let atLock = 0;
    let releaseLock!: () => void;
    const lockBarrier = new Promise<void>((resolve) => { releaseLock = resolve; });
    let updates = 0;
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => {
                const snapshot = { id: "assignment-1", tenantId: "tenant-1", brokerId: "broker-1", ...state };
                atLock += 1;
                if (atLock === 2) releaseLock();
                await lockBarrier;
                return [snapshot];
              },
            }),
          }),
        }),
      }),
      update: () => ({
        set: (values: { scheduleId: string; dayOfWeek: number; startsAt: string; endsAt: string }) => ({
          where: () => ({
            returning: async () => {
              if (state.scheduleId !== "schedule-source" || state.status !== "active") return [];
              Object.assign(state, values);
              updates += 1;
              return [{ id: "assignment-1" }];
            },
          }),
        }),
      }),
    };
    const expected = { id: "assignment-1", tenantId: "tenant-1", brokerId: "broker-1", scheduleId: "schedule-source", dayOfWeek: 1, startsAt: "09:00", endsAt: "13:00" };
    const results = await Promise.all([
      moveWeeklyRosterAssignment(tx as never, { expected, target: { scheduleId: "schedule-a", dayOfWeek: 2, startsAt: "09:00", endsAt: "13:00", actorId: "director-a", now: new Date() }, prepare: async () => "a" }),
      moveWeeklyRosterAssignment(tx as never, { expected, target: { scheduleId: "schedule-b", dayOfWeek: 3, startsAt: "10:00", endsAt: "14:00", actorId: "director-b", now: new Date() }, prepare: async () => "b" }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(updates).toBe(1);
    expect(["schedule-a", "schedule-b"]).toContain(state.scheduleId);
  });
});
