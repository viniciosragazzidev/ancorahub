import { describe, expect, it } from "vitest";
import { buildManualOfferLeadReleaseUpdate, buildPendingLeadOfferLeadUpdate, calculateBrokerRankingScore, canRotateProvisionalLeadOwner, chooseBroker, defaultIntelligentDistributionPolicy, getDutyCoverage, isAutomaticDistributionBranch, isBlockingActiveOffer, isDeferredDistributionReason, isValidDutyWindow, LEAD_OFFER_ACCEPT_GRACE_MS, OFFER_ENQUEUE_GRACE_MS, rankBrokers, resolveDistributionCandidate, resolveDistributionPolicyScope, resolveDutyFallbackDecision, resolveLeadOfferAcceptance, resolveLeadOfferCycle, resolveQueueCandidateBranchIds, reserveDistributionBranch, selectDistributionBranch, shuffle } from "./domain";

describe("provisional assignment rotation guard", () => {
  it("does not rotate a lead after the broker has started or contacted the customer", () => {
    const startedAt = new Date("2026-09-24T11:00:00.000Z");

    expect(canRotateProvisionalLeadOwner({
      corretorId: "broker-1",
      assignmentSource: "automatic_offer",
      status: "in_contact",
      firstContactAt: startedAt,
      serviceStartedAt: startedAt,
    })).toBe(false);
  });

  it("still rotates an untouched provisional offer on timeout", () => {
    expect(canRotateProvisionalLeadOwner({
      corretorId: "broker-1",
      assignmentSource: "automatic_offer",
      status: "distributed",
      firstContactAt: null,
      serviceStartedAt: null,
    })).toBe(true);
  });

  it("does not rotate a provisional owner after a commercial stage advanced", () => {
    expect(canRotateProvisionalLeadOwner({
      corretorId: "broker-1",
      assignmentSource: "manual_offer",
      status: "negotiation",
      firstContactAt: null,
      serviceStartedAt: null,
    })).toBe(false);
  });
});

describe("shuffle", () => {
  it("returns a permutation of the input — same elements, same length", () => {
    const input = ["a", "b", "c", "d", "e"];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = ["a", "b", "c"];
    shuffle(input, () => 0.9);
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("is deterministic for a given random source", () => {
    const input = ["a", "b", "c", "d"];
    expect(shuffle(input, () => 0)).toEqual(shuffle(input, () => 0));
  });
});

describe("automatic unit routing", () => {
  it("chooses the unit with the fewest leads received rather than the fewest active leads", () => {
    const branches = [
      { id: "unit-b", createdAt: new Date("2026-01-02"), receivedLeads: 37 },
      { id: "unit-c", createdAt: new Date("2026-01-03"), receivedLeads: 3 },
      { id: "unit-a", createdAt: new Date("2026-01-01"), receivedLeads: 9 },
    ];
    expect(selectDistributionBranch(branches)?.id).toBe("unit-c");
    expect(selectDistributionBranch([])).toBeNull();
  });

  it("serializes concurrent reservations so equal candidates cannot all use one stale load snapshot", async () => {
    const queues = new Map<string, Array<() => void>>();
    const held = new Set<string>();
    const withLock = async <T>(key: string, work: () => Promise<T>) => {
      if (held.has(key)) {
        await new Promise<void>((resolve) => {
          const queue = queues.get(key) ?? [];
          queue.push(resolve);
          queues.set(key, queue);
        });
      }
      held.add(key);
      try {
        return await work();
      } finally {
        const next = queues.get(key)?.shift();
        if (next) next();
        else held.delete(key);
      }
    };
    const received = new Map([["unit-a", 0], ["unit-b", 0], ["unit-c", 0]]);
    const routeOne = () => reserveDistributionBranch({
      withLock: (work) => withLock("tenant-a:automatic-unit-routing", work),
      getCandidates: async () => [...received].map(([id, receivedLeads]) => ({ id, receivedLeads, createdAt: new Date(0) })),
      reserve: async (branch) => {
        received.set(branch.id, received.get(branch.id)! + 1);
        return branch.id;
      },
    });

    const results = await Promise.all(Array.from({ length: 120 }, routeOne));

    expect(results.every((result) => result.status === "reserved")).toBe(true);
    expect([...received.values()]).toEqual([40, 40, 40]);
  });
});

describe("duty fallback policy", () => {
  it("uses the normal unit roster when an explicit duty is inactive and continuity is selected", () => {
    expect(resolveDutyFallbackDecision({
      policy: "unit_roster",
      hasExplicitSchedule: true,
      hasActiveSelectedSchedule: false,
    })).toBe("use_unit_roster");
  });

  it("keeps strict queues waiting when no selected duty is active", () => {
    expect(resolveDutyFallbackDecision({
      policy: "wait_next_duty",
      hasExplicitSchedule: true,
      hasActiveSelectedSchedule: false,
    })).toBe("wait_next_duty");
  });

  it("does not apply a fallback while one of the selected duties is active", () => {
    expect(resolveDutyFallbackDecision({
      policy: "fallback_queue",
      hasExplicitSchedule: true,
      hasActiveSelectedSchedule: true,
    })).toBe("use_selected_duty");
  });

  it("keeps queues without an explicit duty on the normal roster", () => {
    expect(resolveDutyFallbackDecision({
      policy: "wait_next_duty",
      hasExplicitSchedule: false,
      hasActiveSelectedSchedule: false,
    })).toBe("use_selected_duty");
  });
});

describe("lead offer ownership", () => {
  it("links the lead provisionally to the offered broker until acceptance or rotation", () => {
    const now = new Date("2026-09-15T15:00:00Z");
    const pendingUpdate = buildPendingLeadOfferLeadUpdate({
      targetBranchId: "unit-a",
      brokerId: "broker-a",
      now,
    });

    expect(pendingUpdate).toEqual({
      branchId: "unit-a",
      corretorId: "broker-a",
      status: "distributed",
      distributionStatus: "assigned",
      assignedAt: now,
      assignmentSource: "automatic_offer",
      assignmentStrategy: "whatsapp_offer",
      distributionUpdatedAt: now,
      stageEnteredAt: now,
      firstContactAt: null,
      serviceStartedAt: null,
      serviceStartedBy: null,
      motivoPerda: null,
      updatedAt: now,
    });
  });

  it("marks a manually selected offer separately so expiry can release only that provisional owner", () => {
    const now = new Date("2026-09-23T12:00:00Z");
    const pendingUpdate = buildPendingLeadOfferLeadUpdate({
      targetBranchId: "unit-a",
      brokerId: "broker-selected",
      now,
      assignmentSource: "manual_offer",
    });

    expect(pendingUpdate.assignmentSource).toBe("manual_offer");
    expect(pendingUpdate.corretorId).toBe("broker-selected");
    expect(buildPendingLeadOfferLeadUpdate({
      targetBranchId: "unit-a",
      brokerId: "broker-auto",
      now,
    }).assignmentSource).toBe("automatic_offer");
  });

  it("keeps a declined manual offer in the current distribution cycle so fallback does not immediately re-offer the same broker", () => {
    const startedAt = new Date("2026-09-23T12:00:00Z");
    const releasedAt = new Date("2026-09-23T12:05:00Z");
    const release = buildManualOfferLeadReleaseUpdate(releasedAt, startedAt);

    expect(release.corretorId).toBeNull();
    expect(release.distributionStatus).toBe("queued");
    expect(release.distributionUpdatedAt).toBe(startedAt);
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-selected", "broker-next"],
      cycleStartedAt: release.distributionUpdatedAt,
      offers: [{ brokerId: "broker-selected", status: "DECLINED", offeredAt: startedAt, expiresAt: releasedAt }],
      now: releasedAt,
    });
    expect(cycle.remainingBrokerIds).toEqual(["broker-next"]);
  });
});

describe("lead distribution domain", () => {
  it("chooses the lowest active workload when capacity is available", () => {
    const result = chooseBroker([
      { id: "a", createdAt: new Date("2026-01-01"), activeLeads: 4, capacity: 5 },
      { id: "b", createdAt: new Date("2026-01-02"), activeLeads: 1, capacity: 5 },
    ], "capacity");
    expect(result?.id).toBe("b");
  });

  it("does not choose a broker at capacity", () => {
    const result = chooseBroker([{ id: "a", createdAt: new Date(), activeLeads: 5, capacity: 5 }], "capacity");
    expect(result).toBeNull();
  });

  it("keeps a lead queued when every eligible broker reached the hard capacity limit", () => {
    const policy = defaultIntelligentDistributionPolicy;
    const decision = resolveDistributionCandidate([
      { id: "busy", createdAt: new Date("2026-01-01"), activeLeads: 8, capacity: 5, onDuty: false, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0, unstartedLeads: 4 },
      { id: "less-busy", createdAt: new Date("2026-01-02"), activeLeads: 6, capacity: 5, onDuty: false, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0, unstartedLeads: 2 },
    ], policy, "capacity");
    expect(decision.selected).toBeNull();
    expect(decision.eligible).toEqual([]);
  });

  it("uses the oldest eligible broker for the current round-robin policy", () => {
    const result = chooseBroker([
      { id: "newer", createdAt: new Date("2026-02-01"), activeLeads: 0, capacity: null },
      { id: "older", createdAt: new Date("2026-01-01"), activeLeads: 9, capacity: null },
    ], "round_robin");

    expect(result?.id).toBe("older");
  });

  it("spreads capacity-strategy ties across every equally-loaded broker, not just the oldest account", () => {
    const brokers = [
      { id: "broker-1", createdAt: new Date("2026-01-01"), activeLeads: 0, capacity: null },
      { id: "broker-2", createdAt: new Date("2026-01-02"), activeLeads: 0, capacity: null },
      { id: "broker-3", createdAt: new Date("2026-01-03"), activeLeads: 0, capacity: null },
    ];
    const picks = new Set(Array.from({ length: 200 }, () => chooseBroker(brokers, "capacity")?.id));
    expect(picks.size).toBeGreaterThan(1);
  });

  it("validates duty windows deterministically", () => {
    expect(isValidDutyWindow(1, "09:00", "18:00")).toBe(true);
    expect(isValidDutyWindow(1, "18:00", "09:00")).toBe(false);
    expect(isValidDutyWindow(8, "09:00", "18:00")).toBe(false);
  });

  it("reports a real coverage gap without changing eligibility", () => {
    expect(getDutyCoverage(1, 2)).toEqual({ assigned: 1, minimum: 2, missing: 1, covered: false });
    expect(getDutyCoverage(3, 2)).toEqual({ assigned: 3, minimum: 2, missing: 0, covered: true });
  });

  it("always ranks active duty before performance", () => {
    const ranked = rankBrokers([
      { id: "high", createdAt: new Date("2026-01-01"), activeLeads: 1, capacity: null, onDuty: false, conversionRate: 1, slaRate: 1, manualPriority: 1, idleSince: new Date("2026-01-01"), rankingScore: 100 },
      { id: "duty", createdAt: new Date("2026-01-02"), activeLeads: 3, capacity: null, onDuty: true, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0 },
    ], defaultIntelligentDistributionPolicy);
    expect(ranked.map((broker) => broker.id)).toEqual(["duty", "high"]);
  });

  it("spreads brokers tied on every criterion, instead of always the oldest account", () => {
    // Same shape as a freshly-created queue: several brokers with identical
    // duty/cooldown/load/performance — nothing left to rank them on except
    // account age, which used to mean the same single broker got every lead.
    const tiedBroker = (id: string, createdAt: string) => ({
      id, createdAt: new Date(createdAt), activeLeads: 0, capacity: null, onDuty: true,
      conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0,
    });
    const brokers = [
      tiedBroker("broker-1", "2026-01-01"),
      tiedBroker("broker-2", "2026-01-02"),
      tiedBroker("broker-3", "2026-01-03"),
    ];
    const picks = new Set(Array.from({ length: 200 }, () => rankBrokers(brokers, defaultIntelligentDistributionPolicy)[0]?.id));
    expect(picks.size).toBeGreaterThan(1);
  });

  it("prioritizes brokers outside the 5-minute cooldown window", () => {
    const now = new Date("2026-08-27T14:10:00Z");
    const recentAssignment = new Date("2026-08-27T14:08:00Z"); // 2 min ago (cooled down)
    const oldAssignment = new Date("2026-08-27T14:00:00Z"); // 10 min ago (ready)

    const ranked = rankBrokers([
      { id: "recent", createdAt: new Date("2026-01-01"), activeLeads: 1, capacity: null, onDuty: true, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: recentAssignment, lastAssignedAt: recentAssignment, rankingScore: 0 },
      { id: "ready", createdAt: new Date("2026-01-02"), activeLeads: 1, capacity: null, onDuty: true, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: oldAssignment, lastAssignedAt: oldAssignment, rankingScore: 0 },
    ], defaultIntelligentDistributionPolicy, now);

    expect(ranked[0]?.id).toBe("ready");
  });

  it("prioritizes brokers with fewer unstarted leads", () => {
    const ranked = rankBrokers([
      { id: "busy", createdAt: new Date("2026-01-01"), activeLeads: 2, unstartedLeads: 3, capacity: null, onDuty: true, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0 },
      { id: "free", createdAt: new Date("2026-01-02"), activeLeads: 2, unstartedLeads: 0, capacity: null, onDuty: true, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0 },
    ], defaultIntelligentDistributionPolicy);

    expect(ranked[0]?.id).toBe("free");
  });

  it("calculates an explainable weighted broker score", () => {
    expect(calculateBrokerRankingScore({ conversionRate: 1, slaRate: 1, manualPriority: 0 }, defaultIntelligentDistributionPolicy)).toBe(80);
  });

  it("keeps one active offer exclusive until it expires", () => {
    const now = new Date("2026-09-08T15:00:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        { brokerId: "broker-a", status: "SENT", expiresAt: new Date("2026-09-08T15:03:00Z") },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBe("broker-a");
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
    expect(cycle.exhausted).toBe(false);
  });

  it("advances to brokers that have not received the lead yet", () => {
    const now = new Date("2026-09-08T15:10:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b", "broker-c"],
      offers: [
        { brokerId: "broker-a", status: "DECLINED", expiresAt: now },
        { brokerId: "broker-b", status: "EXPIRED", expiresAt: now },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBeNull();
    expect(cycle.remainingBrokerIds).toEqual(["broker-c"]);
    expect(cycle.exhausted).toBe(false);
  });

  it("marks the current cycle exhausted after every eligible broker was attempted", () => {
    const now = new Date("2026-09-08T15:10:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        { brokerId: "broker-a", status: "DECLINED", expiresAt: now },
        { brokerId: "broker-b", status: "EXPIRED", expiresAt: now },
      ],
      now,
    });

    expect(cycle.remainingBrokerIds).toEqual([]);
    expect(cycle.exhausted).toBe(true);
  });

  it("starts a new automatic cycle without deleting the previous offer history", () => {
    const cycleStartedAt = new Date("2026-09-10T15:00:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        { brokerId: "broker-a", status: "DECLINED", offeredAt: new Date("2026-09-10T14:00:00Z"), expiresAt: cycleStartedAt },
        { brokerId: "broker-b", status: "EXPIRED", offeredAt: new Date("2026-09-10T14:05:00Z"), expiresAt: cycleStartedAt },
      ],
      cycleStartedAt,
      now: new Date("2026-09-10T15:02:00Z"),
    });

    expect(cycle.attemptedBrokerIds.size).toBe(0);
    expect(cycle.remainingBrokerIds).toEqual(["broker-a", "broker-b"]);
    expect(cycle.exhausted).toBe(false);
  });

  it("treats unavailable-channel attempts as consumed and advances immediately", () => {
    const now = new Date("2026-09-08T15:10:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        { brokerId: "broker-a", status: "CANCELLED", expiresAt: now },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBeNull();
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
    expect(cycle.exhausted).toBe(false);
  });

  it("does not keep an overdue pending offer active", () => {
    const now = new Date("2026-09-08T15:10:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        { brokerId: "broker-a", status: "PENDING", expiresAt: new Date("2026-09-08T15:09:59Z") },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBeNull();
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
    expect(cycle.exhausted).toBe(false);
  });

  it("keeps a freshly enqueued offer without a linked outbox row as the exclusive active offer (bug: duplicate offers)", () => {
    const now = new Date("2026-09-14T15:00:30Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        {
          brokerId: "broker-a",
          status: "PENDING",
          outboundMessageId: null,
          offeredAt: new Date("2026-09-14T15:00:00Z"),
          expiresAt: new Date("2026-09-14T15:03:00Z"),
        },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBe("broker-a");
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
  });

  it("releases an orphaned PENDING offer whose outbox linkage never landed (bug: lead fica indisponível)", () => {
    const now = new Date("2026-09-14T15:05:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        {
          brokerId: "broker-a",
          status: "PENDING",
          outboundMessageId: null,
          offeredAt: new Date("2026-09-14T15:00:00Z"),
          expiresAt: new Date("2026-09-14T15:03:00Z"),
        },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBeNull();
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
  });

  it("never blocks on a sent offer whose outbox linkage is missing", () => {
    const now = new Date("2026-09-10T15:00:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        {
          brokerId: "broker-a",
          status: "SENT",
          outboundMessageId: null,
          expiresAt: new Date("2026-09-10T15:03:00Z"),
        },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBeNull();
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
  });

  it("treats an offer with unknown (legacy) linkage as blocking", () => {
    const now = new Date("2026-09-10T15:00:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        {
          brokerId: "broker-a",
          status: "SENT",
          expiresAt: new Date("2026-09-10T15:03:00Z"),
        },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBe("broker-a");
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
  });

  it("honors a slightly-late accept from the provisional owner within the grace window", () => {
    const now = new Date("2026-09-14T15:03:30Z");
    const decision = resolveLeadOfferAcceptance({
      offerStatus: "SENT",
      expiresAt: new Date("2026-09-14T15:03:00Z"),
      leadCorretorId: "broker-a",
      brokerId: "broker-a",
    }, now);

    expect(decision.isExpired).toBe(false);
    expect(decision.isAcceptable).toBe(true);
    expect(decision.withinGrace).toBe(true);
  });

  it("rejects a late accept beyond the grace window", () => {
    const now = new Date("2026-09-14T15:04:31Z");
    const decision = resolveLeadOfferAcceptance({
      offerStatus: "SENT",
      expiresAt: new Date("2026-09-14T15:03:00Z"),
      leadCorretorId: "broker-a",
      brokerId: "broker-a",
    }, now);

    expect(decision.isExpired).toBe(true);
    expect(decision.isAcceptable).toBe(false);
  });

  it("grants no grace window to a broker who never received the provisional ownership", () => {
    const now = new Date("2026-09-14T15:03:30Z");
    const decision = resolveLeadOfferAcceptance({
      offerStatus: "SENT",
      expiresAt: new Date("2026-09-14T15:03:00Z"),
      leadCorretorId: null,
      brokerId: "broker-a",
    }, now);

    expect(decision.isExpired).toBe(true);
    expect(decision.isAcceptable).toBe(false);
  });

  it("exposes the documented grace constants", () => {
    expect(OFFER_ENQUEUE_GRACE_MS).toBe(2 * 60 * 1000);
    expect(LEAD_OFFER_ACCEPT_GRACE_MS).toBe(60 * 1000);
  });

  it("isBlockingActiveOffer keeps legacy linkage blocking until expiry", () => {
    const now = new Date("2026-09-14T15:00:00Z");
    expect(isBlockingActiveOffer({ status: "DELIVERED", expiresAt: new Date("2026-09-14T15:03:00Z") }, now)).toBe(true);
    expect(isBlockingActiveOffer({ status: "DELIVERED", expiresAt: new Date("2026-09-14T14:59:59Z") }, now)).toBe(false);
  });

  it("does not treat an offer without a durable outbound message as delivered to a broker", () => {
    const now = new Date("2026-09-10T15:00:00Z");
    const cycle = resolveLeadOfferCycle({
      eligibleBrokerIds: ["broker-a", "broker-b"],
      offers: [
        {
          brokerId: "broker-a",
          status: "PENDING",
          outboundMessageId: null,
          offeredAt: new Date("2026-09-10T14:55:00Z"),
          expiresAt: new Date("2026-09-10T15:03:00Z"),
        },
      ],
      now,
    });

    expect(cycle.activeBrokerId).toBeNull();
    expect(cycle.remainingBrokerIds).toEqual(["broker-b"]);
  });

  it("shares the same deterministic candidate decision with a simulator", () => {
    const decision = resolveDistributionCandidate([
      { id: "available", createdAt: new Date("2026-01-01"), activeLeads: 2, capacity: 10, onDuty: false, conversionRate: 0, slaRate: 0, manualPriority: 0, idleSince: null, rankingScore: 0 },
      { id: "full", createdAt: new Date("2026-01-02"), activeLeads: 10, capacity: 10, onDuty: true, conversionRate: 1, slaRate: 1, manualPriority: 1, idleSince: null, rankingScore: 100 },
    ], { ...defaultIntelligentDistributionPolicy, ranking: { ...defaultIntelligentDistributionPolicy.ranking, enabled: false } }, "capacity");
    expect(decision.selected?.id).toBe("available");
    expect(decision.eligible.map((broker) => broker.id)).toEqual(["available"]);
  });

  it("keeps a queue retryable while its configured unit has no eligible broker", () => {
    expect(isDeferredDistributionReason("Nenhum corretor elegível nesta unidade.")).toBe(true);
    expect(isDeferredDistributionReason("Aguardando intervalo entre ofertas: os corretores elegíveis receberam um lead há pouco.")).toBe(true);
    expect(isDeferredDistributionReason("A fila configurada pertence a outra unidade.")).toBe(true);
  });

  it("uses only the configured policy units for a general queue", () => {
    expect(resolveQueueCandidateBranchIds({
      queueBranchId: null,
      allowedBranchIds: ["centro-1", "centro-2", "centro-1"],
    })).toEqual(["centro-1", "centro-2"]);
  });

  it("keeps an unrestricted general queue eligible for all units", () => {
    expect(resolveQueueCandidateBranchIds({
      queueBranchId: null,
      allowedBranchIds: [],
      leadBranchId: "source-unit",
    })).toEqual([]);
  });

  it("keeps a unit queue local even when its policy contains other units", () => {
    expect(resolveQueueCandidateBranchIds({
      queueBranchId: "matriz",
      allowedBranchIds: ["centro-1", "centro-2"],
    })).toEqual(["matriz"]);
  });

  it("does not turn the headquarters intake point into a distribution unit", () => {
    expect(resolveQueueCandidateBranchIds({
      queueBranchId: null,
      allowedBranchIds: [],
    })).toEqual([]);
  });

  it("keeps the Matriz available for human redistribution but out of automatic distribution", () => {
    expect(isAutomaticDistributionBranch({ status: "active", acceptingLeads: true, autoDistribute: true, isDistributionHub: true })).toBe(false);
    expect(isAutomaticDistributionBranch({ status: "active", acceptingLeads: true, autoDistribute: true, isDistributionHub: false })).toBe(true);
  });

  it("keeps the automatic policy lookup inside the exact queue and profile scope", () => {
    expect(resolveDistributionPolicyScope(null, null)).toEqual({
      queueId: null,
      profileKey: null,
    });
    expect(resolveDistributionPolicyScope("queue-a", null)).toEqual({
      queueId: "queue-a",
      profileKey: null,
    });
  });
});
