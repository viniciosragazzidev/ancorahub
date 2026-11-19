import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CALL_ANCORA_NEXT_DELAY_MS, CALL_ANCORA_PAIR_TTL_MS, CallAncoraSessionStore } from "./session-store";

describe("CallAncoraSessionStore", () => {
  let now: number;
  let store: CallAncoraSessionStore;

  beforeEach(() => {
    now = Date.parse("2026-11-19T12:00:00.000Z");
    store = new CallAncoraSessionStore(() => now);
  });

  it("pareia um dispositivo com token de uso único", () => {
    const started = store.create({ tenantId: "t1", brokerId: "b1" }, "Ana Souza");
    expect(started.snapshot.brokerFirstName).toBe("Ana");
    const paired = store.pair(started.pairingToken);
    expect(paired.ok).toBe(true);
    if (!paired.ok) return;
    expect(store.getForDevice(paired.deviceToken)?.status).toBe("active");
    expect(store.pair(started.pairingToken)).toEqual({ ok: false, reason: "reused" });
  });

  it("recusa token expirado", () => {
    const started = store.create({ tenantId: "t1", brokerId: "b1" }, "Ana");
    now += CALL_ANCORA_PAIR_TTL_MS;
    expect(store.pair(started.pairingToken)).toEqual({ ok: false, reason: "expired" });
  });

  it("mantém o bypass da flag desligada apenas na sessão temporária de admin/dev", () => {
    const adminSession = store.create({ tenantId: "t1", brokerId: "admin-view" }, "Vinicios", { flagBypass: true });
    expect(store.pairingCanUseWhenFlagDisabled(adminSession.pairingToken)).toBe(true);
    const adminPair = store.pair(adminSession.pairingToken);
    if (!adminPair.ok) throw new Error("O pareamento do admin deveria funcionar.");
    expect(store.deviceCanUseWhenFlagDisabled(adminPair.deviceToken)).toBe(true);

    const brokerSession = store.create({ tenantId: "t1", brokerId: "broker-1" }, "Ana");
    expect(store.pairingCanUseWhenFlagDisabled(brokerSession.pairingToken)).toBe(false);
    const brokerPair = store.pair(brokerSession.pairingToken);
    if (!brokerPair.ok) throw new Error("O pareamento do corretor deveria funcionar.");
    expect(store.deviceCanUseWhenFlagDisabled(brokerPair.deviceToken)).toBe(false);
  });

  it("só avança depois da classificação e permite pausar o intervalo", () => {
    const started = store.create({ tenantId: "t1", brokerId: "b1" }, "Ana");
    const paired = store.pair(started.pairingToken);
    if (!paired.ok) throw new Error("O pareamento deveria funcionar.");
    expect(store.updateCallStatus(paired.deviceToken, "dialing")?.callStatus).toBe("dialing");
    expect(store.updateCallStatus(paired.deviceToken, "ringing")?.callStatus).toBe("ringing");
    expect(store.updateCallStatus(paired.deviceToken, "active")?.callStatus).toBe("active");
    expect(store.updateCallStatus(paired.deviceToken, "ended")?.callStatus).toBe("ended");
    const classified = store.classify({ tenantId: "t1", brokerId: "b1" }, "interested");
    expect(classified?.interests).toHaveLength(1);
    expect(classified?.current?.id).toBe("demo-01");
    expect(store.pauseCountdown({ tenantId: "t1", brokerId: "b1" })?.countdown?.paused).toBe(true);
    now += CALL_ANCORA_NEXT_DELAY_MS + 10_000;
    expect(store.getForBroker({ tenantId: "t1", brokerId: "b1" })?.current?.id).toBe("demo-01");
    expect(store.resumeCountdown({ tenantId: "t1", brokerId: "b1" })?.current?.id).toBe("demo-01");
    now += CALL_ANCORA_NEXT_DELAY_MS;
    expect(store.getForBroker({ tenantId: "t1", brokerId: "b1" })?.current?.id).toBe("demo-02");
  });

  it("isola sessões por corretor e tenant", () => {
    const first = store.create({ tenantId: "t1", brokerId: "b1" }, "Ana");
    store.create({ tenantId: "t1", brokerId: "b2" }, "Bruno");
    store.create({ tenantId: "t2", brokerId: "b1" }, "Carla");
    expect(store.getForBroker({ tenantId: "t1", brokerId: "b1" })?.sessionId).toBe(first.snapshot.sessionId);
    expect(store.getForBroker({ tenantId: "t1", brokerId: "b2" })?.brokerFirstName).toBe("Bruno");
    expect(store.getForBroker({ tenantId: "t2", brokerId: "b1" })?.brokerFirstName).toBe("Carla");
  });
});
