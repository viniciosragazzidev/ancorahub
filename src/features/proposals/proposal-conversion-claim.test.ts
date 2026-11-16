import { describe, expect, it } from "vitest";

import { claimProposalConversion } from "./proposal-conversion-claim";

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

describe("claimProposalConversion", () => {
  it("duas chamadas simultâneas reservam a proposta uma vez e reutilizam a venda vencedora", async () => {
    let convertedSaleId: string | null = null;
    let effects = 0;
    const waitForBoth = createBarrier(2);
    const tx = {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              await waitForBoth();
              if (convertedSaleId) return [];
              convertedSaleId = Math.random().toString(36).slice(2);
              effects += 1;
              return [{ id: "proposal-1" }];
            },
          }),
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ convertedSaleId }] }),
        }),
      }),
    };

    const results = await Promise.all([
      claimProposalConversion(tx as never, { tenantId: "tenant-1", proposalId: "proposal-1", saleId: "sale-a", convertedAt: new Date() }),
      claimProposalConversion(tx as never, { tenantId: "tenant-1", proposalId: "proposal-1", saleId: "sale-b", convertedAt: new Date() }),
    ]);

    expect(results.filter((result) => result.kind === "claimed")).toHaveLength(1);
    expect(results.filter((result) => result.kind === "already_converted")).toHaveLength(1);
    expect(effects).toBe(1);
  });
});
