import { describe, expect, it } from "vitest";
import { aggregatePostSaleBrokerReport, summarizePostSaleReport } from "./reporting";

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
      { brokerId: "broker-1", brokerName: "Ana", sent: 3, responded: 2, attendancePercent: 50, attendanceAnswered: 2, attended: 1, averageRating: 3, ratingCount: 2, ratingTotal: 6, closePercent: 50, closeAnswered: 2, closed: 1, noContact: 1, openAlerts: 1, customerReturned: 0 },
      { brokerId: "broker-2", brokerName: "Bia", sent: 0, responded: 0, attendancePercent: null, attendanceAnswered: 0, attended: 0, averageRating: null, ratingCount: 0, ratingTotal: 0, closePercent: null, closeAnswered: 0, closed: 0, noContact: 0, openAlerts: 0, customerReturned: 0 },
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

  it("counts R0 conversations apart, as client who came back without an answer", () => {
    const report = aggregatePostSaleBrokerReport({
      brokers: [{ id: "broker-1", name: "Ana" }],
      surveys: [
        { brokerId: "broker-1", sentAt: new Date("2026-10-10T12:00:00.000Z"), lastReplyAt: new Date("2026-10-10T12:05:00.000Z"), outcome: "r0_not_attended", rating: null, answers: { r0: { category: "not_attended" } }, alertsHandledAt: null, ruleKey: "R0" },
        { brokerId: "broker-1", sentAt: new Date("2026-10-11T12:00:00.000Z"), lastReplyAt: null, outcome: null, rating: null, answers: {}, alertsHandledAt: null, ruleKey: "R0" },
      ],
      from,
      to,
    });
    expect(report[0]).toMatchObject({ sent: 0, responded: 0, noContact: 0, customerReturned: 2, openAlerts: 1 });
  });

  it("summarizes the KPI strip weighting attendance and rating by what was answered", () => {
    const base = { brokerName: "x", attendancePercent: null, averageRating: null, closePercent: null, closeAnswered: 0, closed: 0, noContact: 0, openAlerts: 0, customerReturned: 0 };
    const summary = summarizePostSaleReport([
      { ...base, brokerId: "a", sent: 10, responded: 4, attended: 3, attendanceAnswered: 4, ratingCount: 1, ratingTotal: 5 },
      { ...base, brokerId: "b", sent: 5, responded: 1, attended: 0, attendanceAnswered: 1, ratingCount: 3, ratingTotal: 6 },
    ], 2);
    expect(summary).toEqual({ sent: 15, responded: 5, attendancePercent: 60, averageRating: 2.8, openAlerts: 2 });
    expect(summarizePostSaleReport([], 0)).toEqual({ sent: 0, responded: 0, attendancePercent: null, averageRating: null, openAlerts: 0 });
  });
});
