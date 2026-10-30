import { describe, expect, it } from "vitest";

import { chooseManualQueuePick } from "./duty-queue-order";
import { isSkipOfferStatus, rotationArrivalOrder, skipReachesPauseLimit } from "./duty-rotation";

const at = (clock: string) => new Date(`2026-10-29T${clock}:00-03:00`);

/** Runs the locked pick like offers.ts does, persisting the next order between leads. */
function distribute(leads: number, roster: string[], options: { blocked?: (lead: number) => string[]; joinAt?: Record<number, string> } = {}) {
  let stored: string[] | undefined;
  let currentRoster = [...roster];
  const received: string[] = [];
  for (let lead = 0; lead < leads; lead += 1) {
    const joining = options.joinAt?.[lead];
    if (joining) currentRoster = [...currentRoster, joining];
    const blocked = new Set(options.blocked?.(lead) ?? []);
    const pending = currentRoster.filter((id) => !blocked.has(id));
    const pick = chooseManualQueuePick({
      lockAcquired: true,
      automaticBrokerId: pending[0] ?? null,
      pendingBrokerIds: pending,
      scheduleIdByBroker: Object.fromEntries(currentRoster.map((id) => [id, "manha"])),
      queueBySchedule: stored ? { manha: stored } : {},
      rosterBrokerIdsBySchedule: { manha: currentRoster },
      seedMissing: true,
    });
    if (pick.manual) stored = pick.nextOrder;
    if (pick.brokerId) received.push(pick.brokerId);
  }
  return received;
}

describe("plantão rotation (29/10)", () => {
  it("starts in the order brokers confirmed presence", () => {
    expect(rotationArrivalOrder([
      { brokerId: "bia", arrivedAt: at("08:55") },
      { brokerId: "ana", arrivedAt: at("08:40") },
      { brokerId: "caio", arrivedAt: at("09:10") },
    ])).toEqual(["ana", "bia", "caio"]);
  });

  it("keeps the roster order when nobody confirmed (same shift start)", () => {
    expect(rotationArrivalOrder([
      { brokerId: "bia", arrivedAt: at("09:00") },
      { brokerId: "ana", arrivedAt: at("09:00") },
      { brokerId: "caio", arrivedAt: null },
    ])).toEqual(["bia", "ana", "caio"]);
  });

  it("gives everyone one turn per round: 100 leads for 10 brokers is 10 each", () => {
    const roster = Array.from({ length: 10 }, (_, index) => `corretor-${index}`);
    const received = distribute(100, roster);
    for (const id of roster) expect(received.filter((brokerId) => brokerId === id)).toHaveLength(10);
  });

  it("puts a late arrival at the end, never making up for the leads that went before", () => {
    // ana, bia and caio got 2 each before duda confirmed: duda enters at the end of the round.
    expect(distribute(10, ["ana", "bia", "caio"], { joinAt: { 6: "duda" } }))
      .toEqual(["ana", "bia", "caio", "ana", "bia", "caio", "ana", "bia", "caio", "duda"]);
  });

  it("a broker blocked on their turn keeps the position and receives once free", () => {
    const received = distribute(4, ["ana", "bia", "caio"], { blocked: (lead) => (lead === 0 ? ["ana"] : []) });
    expect(received).toEqual(["bia", "ana", "caio", "bia"]);
  });

  it("an expired or declined offer is a skip; the 3rd (and every 3rd after) pauses", () => {
    expect(isSkipOfferStatus("EXPIRED")).toBe(true);
    expect(isSkipOfferStatus("DECLINED")).toBe(true);
    expect(isSkipOfferStatus("ACCEPTED")).toBe(false);
    expect(isSkipOfferStatus("CANCELLED")).toBe(false);
    expect([1, 2, 3, 4, 5, 6].map(skipReachesPauseLimit)).toEqual([false, false, true, false, false, true]);
  });
});

describe("rotation never skips the turn because of who the resolver ranked first (30/10)", () => {
  it("takes the plantão group from the first candidate on the plantão", () => {
    const picked = chooseManualQueuePick({
      lockAcquired: true,
      automaticBrokerId: "outsider",
      pendingBrokerIds: ["outsider", "stephanie", "renata"],
      scheduleIdByBroker: { stephanie: "premium", renata: "premium" },
      queueBySchedule: {},
      rosterBrokerIdsBySchedule: { premium: ["renata", "stephanie"] },
      seedMissing: true,
    });
    expect(picked).toMatchObject({ manual: true, brokerId: "renata", nextOrder: ["stephanie", "renata"] });
  });

  it("the last to arrive is last on the first lead of the day", () => {
    const picked = chooseManualQueuePick({
      lockAcquired: true,
      automaticBrokerId: "stephanie",
      pendingBrokerIds: ["stephanie", "renata", "jorge", "vitor"],
      scheduleIdByBroker: { stephanie: "premium", renata: "premium", jorge: "premium", vitor: "premium" },
      queueBySchedule: {},
      rosterBrokerIdsBySchedule: { premium: ["renata", "jorge", "vitor", "stephanie"] },
      seedMissing: true,
    });
    expect(picked).toMatchObject({ manual: true, brokerId: "renata" });
  });
});
