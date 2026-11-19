import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CALL_ANCORA_NEXT_DELAY_MS, CALL_ANCORA_PAIR_TTL_MS, CALL_ANCORA_SESSION_TTL_MS, CallAncoraSessionStore } from "./session-store";

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
    store.setAutoDialEnabled({ tenantId: "t1", brokerId: "b1" }, true);
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

  it("avança automaticamente após três segundos e mantém a pausa até retomar", () => {
    const scope = { tenantId: "t1", brokerId: "b1" };
    const started = store.create(scope, "Ana");
    const paired = store.pair(started.pairingToken);
    if (!paired.ok) throw new Error("O pareamento deveria funcionar.");

    expect(store.setAutoDialEnabled(scope, true)?.autoDialEnabled).toBe(true);
    store.updateCallStatus(paired.deviceToken, "dialing");
    store.updateCallStatus(paired.deviceToken, "ringing");
    store.updateCallStatus(paired.deviceToken, "active");
    store.updateCallStatus(paired.deviceToken, "ended");
    const classified = store.classify(scope, "not_interested");

    expect(classified?.current?.id).toBe("demo-01");
    expect(classified?.countdown).toEqual({ remainingSeconds: 3, paused: false });
    now += 1_000;
    expect(store.pauseCountdown(scope)?.countdown).toEqual({ remainingSeconds: 2, paused: true });
    now += CALL_ANCORA_NEXT_DELAY_MS + 1_000;
    expect(store.getForDevice(paired.deviceToken)?.current?.id).toBe("demo-01");
    expect(store.resumeCountdown(scope)?.current?.id).toBe("demo-01");
    now += 1_999;
    expect(store.getForBroker(scope)?.current?.id).toBe("demo-01");
    now += 1;
    expect(store.getForDevice(paired.deviceToken)?.current?.id).toBe("demo-02");
  });

  it("com discagem automática desligada deixa o próximo contato pronto sem contagem", () => {
    const scope = { tenantId: "t1", brokerId: "b1" };
    const started = store.create(scope, "Ana");
    const paired = store.pair(started.pairingToken);
    if (!paired.ok) throw new Error("O pareamento deveria funcionar.");
    store.updateCallStatus(paired.deviceToken, "dialing");
    store.updateCallStatus(paired.deviceToken, "ringing");
    store.updateCallStatus(paired.deviceToken, "active");
    store.updateCallStatus(paired.deviceToken, "ended");

    const classified = store.classify(scope, "not_interested");

    expect(classified).toMatchObject({
      autoDialEnabled: false,
      callStatus: "ready",
      current: { id: "demo-02" },
      countdown: null,
      completed: 1,
    });
  });

  it("cancelar a discagem automática durante a contagem deixa o próximo contato pronto", () => {
    const scope = { tenantId: "t1", brokerId: "b1" };
    const started = store.create(scope, "Ana");
    const paired = store.pair(started.pairingToken);
    if (!paired.ok) throw new Error("O pareamento deveria funcionar.");
    store.setAutoDialEnabled(scope, true);
    store.updateCallStatus(paired.deviceToken, "dialing");
    store.updateCallStatus(paired.deviceToken, "ringing");
    store.updateCallStatus(paired.deviceToken, "active");
    store.updateCallStatus(paired.deviceToken, "ended");
    store.classify(scope, "not_interested");

    expect(store.setAutoDialEnabled(scope, false)).toMatchObject({
      autoDialEnabled: false,
      callStatus: "ready",
      current: { id: "demo-02" },
      countdown: null,
    });
  });

  it("isola sessões por corretor e tenant", () => {
    const first = store.create({ tenantId: "t1", brokerId: "b1" }, "Ana");
    store.create({ tenantId: "t1", brokerId: "b2" }, "Bruno");
    store.create({ tenantId: "t2", brokerId: "b1" }, "Carla");
    expect(store.getForBroker({ tenantId: "t1", brokerId: "b1" })?.sessionId).toBe(first.snapshot.sessionId);
    expect(store.getForBroker({ tenantId: "t1", brokerId: "b2" })?.brokerFirstName).toBe("Bruno");
    expect(store.getForBroker({ tenantId: "t2", brokerId: "b1" })?.brokerFirstName).toBe("Carla");
  });

  it.each([
    ["getForBroker", (instance: CallAncoraSessionStore) => instance.getForBroker({ tenantId: "missing", brokerId: "missing" })],
    ["getForDevice", (instance: CallAncoraSessionStore) => instance.getForDevice("missing")],
    ["deviceCanUseWhenFlagDisabled", (instance: CallAncoraSessionStore) => instance.deviceCanUseWhenFlagDisabled("missing")],
    ["pairingCanUseWhenFlagDisabled", (instance: CallAncoraSessionStore) => instance.pairingCanUseWhenFlagDisabled("missing")],
  ] as const)("remove sessões vencidas durante a leitura por %s", (_name, read) => {
    const scope = { tenantId: "t1", brokerId: "b1" };
    store.create(scope, "Ana", { flagBypass: true });
    now += CALL_ANCORA_SESSION_TTL_MS + 1;

    read(store);

    now -= CALL_ANCORA_SESSION_TTL_MS + 1;
    expect(store.getForBroker(scope)).toBeNull();
  });
});
