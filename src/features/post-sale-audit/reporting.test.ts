import { describe, expect, it } from "vitest";
import { aggregatePostSaleBrokerReport } from "./reporting";

const from = new Date("2026-10-01T00:00:00.000Z");
const to = new Date("2026-11-01T00:00:00.000Z");

describe("post-sale broker report aggregation", () => {
  it("aggregates sent, answered, attendance, rating, close, no contact and open alerts", () => {
    const report = aggregatePostSaleBrokerReport({
      brokers: [{ id: "broker-1", name: "Ana" }, { id: "broker-2", name: "Bia" }],
      surveys: [
        { brokerId: "broker-1", sentAt: new Date("2026-10-10T12:00:00.000Z"), lastReplyAt: new Date("2026-10-11T12:00:00.000Z"), outcome: "no_contact", rating: 2, answers: { contacted: false, closed: "no", wantsHelp: true }, alertsHandledAt: null },
        { brokerId: "broker-1", sentAt: new Date("2026-10-12T12:00:00.000Z"), lastReplyAt: new Date("2026-10-12T14:00:00.000Z"), outcome: "closed", rating: 4, answers: { contacted: true, closed: "yes" }, alertsHandledAt: null },
        { brokerId: "broker-1", sentAt: new Date("2026-10-13T12:00:00.000Z"), lastReplyAt: null, outcome: null, rating: null, answers: {}, alertsHandledAt: null },
      ],
      from,
      to,
    });

    expect(report).toEqual([
      { brokerId: "broker-1", brokerName: "Ana", sent: 3, responded: 2, attendancePercent: 50, attendanceAnswered: 2, attended: 1, averageRating: 3, closePercent: 50, closeAnswered: 2, closed: 1, noContact: 1, openAlerts: 1 },
      { brokerId: "broker-2", brokerName: "Bia", sent: 0, responded: 0, attendancePercent: null, attendanceAnswered: 0, attended: 0, averageRating: null, closePercent: null, closeAnswered: 0, closed: 0, noContact: 0, openAlerts: 0 },
    ]);
  });

  it("excludes unsent and out-of-period surveys from all metrics", () => {
    const report = aggregatePostSaleBrokerReport({
      brokers: [{ id: "broker-1", name: "Ana" }],
      surveys: [
        { brokerId: "broker-1", sentAt: null, lastReplyAt: new Date("2026-10-15T12:00:00.000Z"), outcome: "no_contact", rating: 1, answers: { contacted: false }, alertsHandledAt: null },
        { brokerId: "broker-1", sentAt: new Date("2026-09-30T23:59:59.000Z"), lastReplyAt: null, outcome: null, rating: null, answers: {}, alertsHandledAt: null },
        { brokerId: "broker-1", sentAt: new Date("2026-11-01T00:00:00.000Z"), lastReplyAt: null, outcome: null, rating: null, answers: {}, alertsHandledAt: null },
      ],
      from,
      to,
    });

    expect(report[0]).toMatchObject({ sent: 0, responded: 0, averageRating: null, openAlerts: 0 });
  });

  it("counts a no-contact outcome even when the answered contact field is missing", () => {
    const report = aggregatePostSaleBrokerReport({
      brokers: [{ id: "broker-1", name: "Ana" }],
      surveys: [{ brokerId: "broker-1", sentAt: new Date("2026-10-10T12:00:00.000Z"), lastReplyAt: new Date("2026-10-10T13:00:00.000Z"), outcome: "no_contact", rating: null, answers: {}, alertsHandledAt: null }],
      from,
      to,
    });
    expect(report[0]).toMatchObject({ sent: 1, responded: 1, attendanceAnswered: 0, attendancePercent: null, noContact: 1, openAlerts: 1 });
  });
});
