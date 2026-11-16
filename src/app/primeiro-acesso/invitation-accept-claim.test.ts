import { describe, expect, it } from "vitest";

import { claimPendingInvitation } from "./invitation-accept-claim";

describe("claimPendingInvitation", () => {
  it("allows only one simultaneous acceptance of a pending invitation", async () => {
    const state = { status: "PENDING", acceptedBy: null as string | null };
    let started = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const tx = {
      update: () => ({
        set: (values: { status: string; email: string }) => ({
          where: () => ({
            returning: async () => {
              started += 1;
              if (started === 2) release();
              await barrier;
              if (state.status !== "PENDING") return [];
              state.status = values.status;
              state.acceptedBy = values.email;
              return [{ id: "invite-1" }];
            },
          }),
        }),
      }),
    };
    const now = new Date();
    const results = await Promise.all([
      claimPendingInvitation(tx as never, { id: "invite-1", tenantId: "tenant-1", email: "a@example.test", now }),
      claimPendingInvitation(tx as never, { id: "invite-1", tenantId: "tenant-1", email: "b@example.test", now }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(state.status).toBe("ACCEPTED");
    expect(["a@example.test", "b@example.test"]).toContain(state.acceptedBy);
  });
});
