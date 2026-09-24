import { describe, expect, it } from "vitest";
import { buildOfferOutcomeHistory } from "./assignment-history";

const offeredAt = new Date("2026-09-24T12:00:00.000Z");
const acceptedAt = new Date("2026-09-24T12:02:00.000Z");
const expiresAt = new Date("2026-09-24T12:03:00.000Z");
const lead = {
  corretorId: "broker-1",
  status: "distributed",
  firstContactAt: null,
  serviceStartedAt: null,
};

describe("buildOfferOutcomeHistory", () => {
  it("shows explicit acceptance and the broker name at acceptedAt", () => {
    const items = buildOfferOutcomeHistory([{
      id: "offer-1", brokerId: "broker-1", brokerName: "Nile Silva", status: "ACCEPTED",
      offeredAt, expiresAt, acceptedAt, declinedAt: null,
    }], lead);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      action: "accepted",
      newOwnerName: "Nile Silva",
      createdAt: acceptedAt.toISOString(),
    });
  });

  it("shows an explicit refusal separately from timeout", () => {
    const items = buildOfferOutcomeHistory([
      { id: "offer-1", brokerId: "broker-1", brokerName: "Nile Silva", status: "DECLINED", offeredAt, expiresAt, acceptedAt: null, declinedAt: acceptedAt },
      { id: "offer-2", brokerId: "broker-2", brokerName: "Ana Lima", status: "EXPIRED", offeredAt, expiresAt, acceptedAt: null, declinedAt: null },
    ], lead);

    expect(items.map(({ action, createdAt, newOwnerName }) => ({ action, createdAt, newOwnerName }))).toEqual([
      { action: "declined", createdAt: acceptedAt.toISOString(), newOwnerName: "Nile Silva" },
      { action: "not_accepted", createdAt: expiresAt.toISOString(), newOwnerName: "Ana Lima" },
    ]);
  });

  it("recognizes that a provisional owner accepted by starting service before the timeout worker runs", () => {
    const startedAt = new Date("2026-09-24T12:01:00.000Z");
    const items = buildOfferOutcomeHistory([{
      id: "offer-1", brokerId: "broker-1", brokerName: "Nile Silva", status: "PENDING",
      offeredAt, expiresAt, acceptedAt: null, declinedAt: null,
    }], {
      ...lead,
      status: "in_contact",
      firstContactAt: startedAt,
      serviceStartedAt: startedAt,
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      action: "accepted",
      newOwnerName: "Nile Silva",
      createdAt: startedAt.toISOString(),
    });
  });

  it("does not infer acceptance for an untouched offer or a different current owner", () => {
    const offer = {
      id: "offer-1", brokerId: "broker-1", brokerName: "Nile Silva", status: "PENDING",
      offeredAt, expiresAt, acceptedAt: null, declinedAt: null,
    };

    expect(buildOfferOutcomeHistory([offer], lead)).toEqual([]);
    expect(buildOfferOutcomeHistory([offer], {
      ...lead,
      corretorId: "broker-2",
      status: "in_contact",
      firstContactAt: acceptedAt,
    })).toEqual([]);
  });

  it("does not mistake offers lost to another winner or still pending for non-acceptance", () => {
    const items = buildOfferOutcomeHistory([
      { id: "offer-1", brokerId: "broker-1", brokerName: "Nile Silva", status: "LOST", offeredAt, expiresAt, acceptedAt: null, declinedAt: null },
      { id: "offer-2", brokerId: "broker-2", brokerName: "Ana Lima", status: "PENDING", offeredAt, expiresAt, acceptedAt: null, declinedAt: null },
    ], lead);

    expect(items).toEqual([]);
  });
});
