import { describe, expect, it } from "vitest";

import { claimPendingDocumentsForReview } from "./document-review-claim";

describe("claimPendingDocumentsForReview", () => {
  it("lets one of two simultaneous reviews claim the pending document", async () => {
    const state = { status: "pending" };
    let arrived = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const tx = {
      update: () => ({
        set: (values: { status: string }) => ({
          where: () => ({
            returning: async () => {
              arrived += 1;
              if (arrived === 2) release();
              await barrier;
              if (state.status !== "pending") return [];
              state.status = values.status;
              return [{ id: "doc-1", leadId: "lead-1", filename: "doc.pdf", requirementId: null, beneficiaryId: null }];
            },
          }),
        }),
      }),
    };
    const results = await Promise.all([
      claimPendingDocumentsForReview(tx as never, { documentIds: ["doc-1"], tenantId: "tenant-1", leadId: "lead-1", status: "approved", reviewerId: "director-a", now: new Date() }),
      claimPendingDocumentsForReview(tx as never, { documentIds: ["doc-1"], tenantId: "tenant-1", leadId: "lead-1", status: "rejected", reviewerId: "director-b", now: new Date() }),
    ]);

    expect(results.filter((rows) => rows.length > 0)).toHaveLength(1);
    expect(["approved", "rejected"]).toContain(state.status);
  });
});
