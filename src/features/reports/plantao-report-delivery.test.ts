import { describe, expect, it, vi } from "vitest";

import { deliverPlantaoReport, type PlantaoDailyReservation } from "./plantao-report-delivery";

const reservation: PlantaoDailyReservation = {
  key: "plantao-report:tenant:2026-11-09",
  token: "token-1",
  expiresAt: "2026-11-11T10:00:00.000Z",
  value: "2026-11-11T10:00:00.000Z|token-1|sending",
};

function createHarness() {
  const locks = new Map<string, PlantaoDailyReservation>();
  const sentKeys: string[] = [];
  const reserveDaily = vi.fn(async () => {
    if (locks.has(reservation.key)) return null;
    locks.set(reservation.key, reservation);
    return reservation;
  });
  const markDailySent = vi.fn(async (current: PlantaoDailyReservation) => {
    if (locks.get(current.key)?.value === current.value) {
      locks.set(current.key, { ...current, value: `${current.expiresAt}|${current.token}|sent` });
    }
  });
  const releaseDaily = vi.fn(async (current: PlantaoDailyReservation) => {
    if (locks.get(current.key)?.value === current.value) locks.delete(current.key);
  });

  const deliver = (input: { manual: boolean; now?: Date }, send: (key: string) => Promise<{ messageId: string }>) => deliverPlantaoReport({
    tenantId: "tenant",
    day: "2026-11-09",
    now: input.now ?? new Date("2026-11-09T22:00:00.000Z"),
    manual: input.manual,
  }, {
    reserveDaily,
    markDailySent,
    releaseDaily,
    send: async (key) => {
      sentKeys.push(key);
      return send(key);
    },
    onSending: async () => undefined,
    onSent: async () => undefined,
    onSideEffectError: vi.fn(),
  });

  return { locks, sentKeys, reserveDaily, markDailySent, releaseDaily, deliver };
}

describe("envio do resultado do plantão", () => {
  it("mantém envio manual fora da cota diária e deduplica cron repetido", async () => {
    const harness = createHarness();
    const send = async () => ({ messageId: `message-${harness.sentKeys.length}` });

    const manual = await harness.deliver({ manual: true, now: new Date("2026-11-09T12:34:56.000Z") }, send);
    const cron = await harness.deliver({ manual: false }, send);
    const repeatedCron = await harness.deliver({ manual: false }, send);

    expect(manual).toEqual({ state: "sent", messageId: "message-1" });
    expect(cron).toEqual({ state: "sent", messageId: "message-2" });
    expect(repeatedCron).toEqual({ state: "duplicate", reason: "already_sent_today" });
    expect(harness.sentKeys).toEqual([
      "plantao-report-manual:tenant:2026-11-09:093456",
      "plantao-report:tenant:2026-11-09",
    ]);
    expect(harness.reserveDaily).toHaveBeenCalledTimes(2);
    expect(harness.markDailySent).toHaveBeenCalledTimes(1);
  });

  it("libera a reserva exata em falha e permite repetir o cron", async () => {
    const harness = createHarness();
    const events: string[] = [];
    harness.releaseDaily.mockImplementation(async (current) => {
      events.push(`released:${current.key}:${current.value}`);
      if (harness.locks.get(current.key)?.value === current.value) harness.locks.delete(current.key);
    });
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("relay offline"))
      .mockResolvedValueOnce({ messageId: "retry-sent" });

    const failed = await harness.deliver({ manual: false }, send);
    expect(failed).toMatchObject({ state: "failed" });
    expect(events).toEqual([`released:${reservation.key}:${reservation.value}`]);
    expect(harness.locks.has(reservation.key)).toBe(false);

    await expect(harness.deliver({ manual: false }, send)).resolves.toEqual({ state: "sent", messageId: "retry-sent" });
    expect(harness.reserveDaily).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("falha manual não cria reserva diária e pode ser tentado novamente", async () => {
    const harness = createHarness();
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("relay offline"))
      .mockResolvedValueOnce({ messageId: "manual-retry-sent" });

    const failed = await harness.deliver({ manual: true, now: new Date("2026-11-09T12:34:56.000Z") }, send);
    const retried = await harness.deliver({ manual: true, now: new Date("2026-11-09T12:35:02.000Z") }, send);

    expect(failed.state).toBe("failed");
    expect(retried.state).toBe("sent");
    expect(harness.reserveDaily).not.toHaveBeenCalled();
    expect(harness.markDailySent).not.toHaveBeenCalled();
    expect(harness.releaseDaily).not.toHaveBeenCalled();
    expect(harness.sentKeys).toEqual([
      "plantao-report-manual:tenant:2026-11-09:093456",
      "plantao-report-manual:tenant:2026-11-09:093502",
    ]);
  });
});
