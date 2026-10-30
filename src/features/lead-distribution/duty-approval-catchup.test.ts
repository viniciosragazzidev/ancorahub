import { describe, expect, it } from "vitest";

import { parseTurnCredit, placeAfterApprovalDelay } from "./duty-approval-catchup";
import { chooseManualQueuePick } from "./duty-queue-order";

describe("presencial: the wait for the approval is not the broker's (30/10)", () => {
  it("takes the place an instant approval would have reached", () => {
    // Queue of 4, 3 leads handed out since the photo: one place from the front.
    expect(placeAfterApprovalDelay({ stored: ["a", "b", "c", "d"], brokerId: "p", offersSincePhoto: 3 })).toEqual({ order: ["a", "p", "b", "c", "d"], credit: 0, missedTurns: 0 });
    // No lead since the photo: at the end, like any arrival.
    expect(placeAfterApprovalDelay({ stored: ["a", "b"], brokerId: "p", offersSincePhoto: 0 }).order).toEqual(["a", "b", "p"]);
  });

  it("lost turns: the next lead, and the rest as credit", () => {
    // Queue of 4, 10 leads since the photo: 2 lost turns, one now and one in credit.
    expect(placeAfterApprovalDelay({ stored: ["a", "b", "c", "d"], brokerId: "p", offersSincePhoto: 10 })).toEqual({ order: ["p", "a", "b", "c", "d"], credit: 1, missedTurns: 2 });
  });

  it("a make-up turn comes back every other lead, never in a row", () => {
    const base = {
      lockAcquired: true,
      pendingBrokerIds: ["p", "a", "b", "c"],
      scheduleIdByBroker: { p: "s", a: "s", b: "s", c: "s" },
      rosterBrokerIdsBySchedule: { s: ["p", "a", "b", "c"] },
      seedMissing: true,
    };
    const first = chooseManualQueuePick({ ...base, automaticBrokerId: "a", queueBySchedule: { s: ["p", "a", "b", "c"] }, creditBySchedule: { s: { p: 1 } } });
    expect(first).toMatchObject({ brokerId: "p", creditUsed: true, nextOrder: ["a", "p", "b", "c"] });
    const second = chooseManualQueuePick({ ...base, automaticBrokerId: "a", queueBySchedule: { s: ["a", "p", "b", "c"] }, creditBySchedule: { s: { p: 0 } } });
    expect(second).toMatchObject({ brokerId: "a", nextOrder: ["p", "b", "c", "a"] });
  });

  it("reads only positive whole credits", () => {
    expect(parseTurnCredit('{"p":2,"q":0,"r":-1,"s":"x"}')).toEqual({ p: 2 });
    expect(parseTurnCredit("oops")).toEqual({});
  });
});
