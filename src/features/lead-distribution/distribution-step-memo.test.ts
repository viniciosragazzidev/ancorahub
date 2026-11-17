import { describe, expect, it } from "vitest";

import { defaultIntelligentDistributionPolicy, KEEP_ORDER_RANDOM, resolveDistributionCandidate, type RankedBroker } from "./domain";
import { createDistributionStepMemo } from "./distribution-step-memo";

type TestRoster = { brokerIds: string[] };

function asCandidates(ids: string[]): RankedBroker[] {
  return ids.map((id, index) => ({
    id,
    createdAt: new Date(`2026-01-0${index + 1}T00:00:00Z`),
    activeLeads: 0,
    capacity: null,
    onDuty: true,
    conversionRate: 0,
    slaRate: 0,
    manualPriority: 0,
    idleSince: null,
    rankingScore: 0,
  }));
}

function choose(ids: string[], excludedId?: string) {
  return resolveDistributionCandidate(
    asCandidates(ids.filter((id) => id !== excludedId)),
    defaultIntelligentDistributionPolicy,
    "round_robin",
    KEEP_ORDER_RANDOM,
  ).selected?.id ?? null;
}

describe("distribution per-step memo", () => {
  it("keeps the same broker sequence after a no-channel re-entry and reduces roster reads", async () => {
    async function run(useMemo: boolean) {
      const step = createDistributionStepMemo<TestRoster>();
      let rosterReads = 0;
      const load = async () => {
        rosterReads += 1;
        return { brokerIds: ["broker-no-channel", "broker-next"] };
      };
      const read = () => useMemo ? step.rosters("unit-a", load) : load();
      const first = choose((await read()).brokerIds);
      const second = choose((await read()).brokerIds, first ?? undefined);
      return { chosen: [first, second], rosterReads };
    }

    const withoutMemo = await run(false);
    const withMemo = await run(true);
    expect(withMemo.chosen).toEqual(withoutMemo.chosen);
    expect(withMemo.chosen).toEqual(["broker-no-channel", "broker-next"]);
    expect(withMemo.rosterReads).toBe(1);
    expect(withoutMemo.rosterReads).toBe(2);
  });

  it("keeps fallback unit order and chosen broker while reducing unit and roster reads", async () => {
    async function run(useMemo: boolean) {
      const step = createDistributionStepMemo<TestRoster>();
      let fallbackReads = 0;
      let rosterReads = 0;
      const fallbackUnits = async () => {
        fallbackReads += 1;
        return ["unit-fallback-a", "unit-fallback-b"];
      };
      const readFallbackUnits = () => useMemo
        ? step.fallbackBranches("fallback", fallbackUnits)
        : fallbackUnits();
      const rosterByUnit: Record<string, string[]> = {
        "unit-fallback-a": ["broker-no-channel"],
        "unit-fallback-b": ["broker-next"],
      };
      const chosen: Array<string | null> = [];

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const units = await readFallbackUnits();
        const rosters = await Promise.all(units.map(async (unit) => {
          const load = async () => {
            rosterReads += 1;
            return { brokerIds: rosterByUnit[unit] ?? [] };
          };
          return useMemo ? step.rosters(unit, load) : load();
        }));
        const orderedIds = rosters.flatMap((roster) => roster.brokerIds);
        chosen.push(choose(orderedIds, chosen[0] ?? undefined));
      }

      return { chosen, fallbackReads, rosterReads };
    }

    const withoutMemo = await run(false);
    const withMemo = await run(true);
    expect(withMemo.chosen).toEqual(withoutMemo.chosen);
    expect(withMemo.chosen).toEqual(["broker-no-channel", "broker-next"]);
    expect(withMemo.fallbackReads).toBe(1);
    expect(withMemo.rosterReads).toBe(2);
    expect(withoutMemo.fallbackReads).toBe(2);
    expect(withoutMemo.rosterReads).toBe(4);
  });

  it("does not leak snapshots between tenants or processQueuedLead calls", async () => {
    let tenantAReads = 0;
    let tenantBReads = 0;
    const tenantAStep = createDistributionStepMemo<TestRoster>();
    const tenantBStep = createDistributionStepMemo<TestRoster>();
    const tenantA = await tenantAStep.rosters("same-unit-id", async () => ({ brokerIds: [`tenant-a-${++tenantAReads}`] }));
    const tenantB = await tenantBStep.rosters("same-unit-id", async () => ({ brokerIds: [`tenant-b-${++tenantBReads}`] }));
    const nextTenantACall = createDistributionStepMemo<TestRoster>();
    const nextTenantA = await nextTenantACall.rosters("same-unit-id", async () => ({ brokerIds: [`tenant-a-${++tenantAReads}`] }));

    expect(tenantA.brokerIds).toEqual(["tenant-a-1"]);
    expect(tenantB.brokerIds).toEqual(["tenant-b-1"]);
    expect(nextTenantA.brokerIds).toEqual(["tenant-a-2"]);
    expect(tenantAReads).toBe(2);
    expect(tenantBReads).toBe(1);
  });
});
