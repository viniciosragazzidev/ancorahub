import { describe, expect, it } from "vitest";

import { completeProposalConversion } from "./proposal-conversion-claim";

describe("completeProposalConversion", () => {
  it("links the proposal only after a sale row exists", async () => {
    const updates: unknown[] = [];
    const tx = {
      update: () => ({
        set: (values: unknown) => ({
          where: () => ({
            returning: async () => {
              updates.push(values);
              return [{ id: "proposal-1" }];
            },
          }),
        }),
      }),
    };

    const completed = await completeProposalConversion(tx as never, {
      tenantId: "tenant-1",
      leadId: "lead-1",
      proposalId: "proposal-1",
      saleId: "sale-1",
      convertedAt: new Date(),
    });

    expect(completed).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it("reports a conflict when the conditional proposal update affects no row", async () => {
    const tx = {
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [] }) }),
      }),
    };

    await expect(completeProposalConversion(tx as never, {
      tenantId: "tenant-1",
      leadId: "lead-1",
      proposalId: "proposal-1",
      saleId: "sale-1",
      convertedAt: new Date(),
    })).resolves.toBe(false);
  });
});
