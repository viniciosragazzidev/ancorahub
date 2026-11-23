import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const flag = vi.hoisted(() => ({ value: "true" }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: vi.fn(async () => flag.value) }));
// Sem banco nos testes de rota: a base de frios vem vazia e o resultado não é gravado.
vi.mock("@/features/call-ancora/cold-base", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/call-ancora/cold-base")>()),
  fetchColdCandidates: vi.fn(async () => []),
}));
vi.mock("@/features/call-ancora/settings", async () => {
  const rules = await import("@/features/call-ancora/settings-rules");
  return { readCallAncoraSettings: vi.fn(async () => rules.CALL_ANCORA_DEFAULT_SETTINGS), countCallAncoraContactsToday: vi.fn(async () => 0) };
});
vi.mock("@/features/call-ancora/session-persistence", () => ({
  ensureDeviceLoaded: vi.fn(async () => undefined),
  ensureSessionLoaded: vi.fn(async () => undefined),
}));
vi.mock("@/features/call-ancora/cold-outcome", () => ({
  CALL_ANCORA_LEAD_TAKEN_MESSAGE: "Este lead já foi para outro corretor.",
  recordColdOutcome: vi.fn(async () => ({ assigned: false, conflict: null })),
}));

import { CALL_ANCORA_PAIR_TTL_MS, CallAncoraSessionStore, callAncoraSessionStore, toDeviceState } from "@/features/call-ancora/session-store";
import { POST as pairPost } from "./pair/route";
import { GET as stateGet } from "./state/route";
import { POST as eventsPost } from "./events/route";
import { POST as controlPost } from "./control/route";
import { POST as classifyPost } from "./classify/route";

let ipCounter = 0;
const nextIp = () => `10.9.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

function pairRequest(token: string, ip = nextIp()) {
  return new Request("http://localhost/api/call-ancora/device/pair", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ token }),
  });
}

function authed(path: string, deviceToken: string, body?: unknown) {
  return new Request(`http://localhost/api/call-ancora/device/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deviceToken}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let tenantSeq = 0;
function newSession(options: { flagBypass?: boolean } = {}) {
  const scope = { tenantId: `tenant-device-${++tenantSeq}`, brokerId: `broker-${tenantSeq}` };
  const started = callAncoraSessionStore.create(scope, "Ana Souza", options);
  return { scope, ...started };
}

async function pairNew(options: { flagBypass?: boolean } = {}) {
  const session = newSession(options);
  const response = await pairPost(pairRequest(session.pairingToken));
  const body = await response.json() as { deviceToken: string; state: { current: { id: string } } };
  return { ...session, deviceToken: body.deviceToken, pairBody: body, status: response.status };
}

describe("API do app Android do Call Âncora", () => {
  beforeEach(() => {
    flag.value = "true";
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pareia com o ticket do QR e devolve token, nome e estado", async () => {
    const paired = await pairNew();
    expect(paired.status).toBe(200);
    expect(paired.deviceToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(paired.pairBody).toMatchObject({ brokerFirstName: "Ana", state: { status: "active" } });
  });

  it("entrega ao celular as regras de desligamento do diretor no pareamento e no estado", async () => {
    const paired = await pairNew();
    const rules = { enabled: true, ringTimeoutSec: 22, quickActiveSec: 4, voicemailAfterSec: 25 };
    expect(paired.pairBody).toMatchObject({ hangup: rules });
    const state = await (await stateGet(authed("state", paired.deviceToken))).json() as { hangup: unknown };
    expect(state.hangup).toEqual(rules);
  });

  it("recusa ticket já usado e ticket vencido", async () => {
    const session = newSession();
    expect((await pairPost(pairRequest(session.pairingToken))).status).toBe(200);
    expect((await pairPost(pairRequest(session.pairingToken))).status).toBe(409);

    const old = newSession();
    const realNow = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(realNow + CALL_ANCORA_PAIR_TTL_MS + 1);
    expect((await pairPost(pairRequest(old.pairingToken))).status).toBe(410);
  });

  it("limita tentativas de pareamento que falham por IP", async () => {
    const ip = "10.250.0.1";
    const fake = "x".repeat(43);
    for (let attempt = 0; attempt < 10; attempt++) expect((await pairPost(pairRequest(fake, ip))).status).toBe(404);
    expect((await pairPost(pairRequest(fake, ip))).status).toBe(429);
  });

  it("exige o token do dispositivo no Authorization", async () => {
    expect((await stateGet(new Request("http://localhost/api/call-ancora/device/state"))).status).toBe(401);
    expect((await stateGet(authed("state", "token-que-nao-existe"))).status).toBe(401);
  });

  it("recusa celular de sessão de corretor quando a flag está desligada", async () => {
    const paired = await pairNew();
    flag.value = "false";
    expect((await stateGet(authed("state", paired.deviceToken))).status).toBe(403);
  });

  it("sem base de frios a fila do celular vem vazia", async () => {
    const paired = await pairNew();
    const body = await (await stateGet(authed("state", paired.deviceToken))).json() as { state: { status: string; total: number; current: unknown } };
    expect(body.state).toMatchObject({ status: "active", total: 0, current: null });
  });

  it("nunca expõe o número de contato não discável e recusa discar para ele", () => {
    const blocked = { id: "frio-1", name: "Não ligar", phone: "+5521999990000", source: "cold_base" as const, dialable: false };
    const following = { id: "frio-2", name: "Outro", phone: "+5521988887777", source: "cold_base" as const, dialable: false };
    const store = new CallAncoraSessionStore(undefined, { kind: "cold_base", initialQueue: () => [blocked, following] });
    const started = store.create({ tenantId: "t-nd", brokerId: "b-nd" }, "Ana");
    const paired = store.pair(started.pairingToken);
    if (!paired.ok) throw new Error("O pareamento deveria funcionar.");
    const state = toDeviceState(paired.snapshot);
    expect(state.current).toMatchObject({ dialable: false, phone: null });
    expect(state.next?.phoneMasked).toBeNull();
    expect(JSON.stringify(state)).not.toContain("99999");
    expect(store.reportDeviceEvent(paired.deviceToken, { contactId: "frio-1", event: "dialing" })).toEqual({ ok: false, reason: "not_dialable" });
  });

  it("isola o token por sessão: outro tenant não lê nem altera esta sessão", async () => {
    const mine = await pairNew({ flagBypass: true });
    const other = newSession({ flagBypass: true });
    const testList = callAncoraSessionStore.setTestList(other.scope, [{ name: "Teste", phone: "+5521999990000" }]);
    const otherContactId = testList?.current?.id ?? "";

    const state = await (await stateGet(authed("state", mine.deviceToken))).json() as { state: { sessionId: string } };
    expect(state.state.sessionId).toBe(mine.snapshot.sessionId);
    expect(state.state.sessionId).not.toBe(other.snapshot.sessionId);

    const response = await eventsPost(authed("events", mine.deviceToken, { contactId: otherContactId, event: "dialing" }));
    expect(response.status).toBe(409);
  });

  it("lista de teste: expõe o número, recebe os eventos e marca Não atendeu sozinho", async () => {
    const paired = await pairNew({ flagBypass: true });
    callAncoraSessionStore.setTestList(paired.scope, [
      { name: "Ana", phone: "+5521999990000" },
      { name: "Bruno", phone: "+5521988887777" },
    ]);
    const state = await (await stateGet(authed("state", paired.deviceToken))).json() as {
      state: { current: { id: string; phone: string; dialable: boolean }; next: { phoneMasked: string } };
    };
    expect(state.state.current).toMatchObject({ dialable: true, phone: "+5521999990000" });
    expect(state.state.next.phoneMasked).toBe("•••• ••77");

    const contactId = state.state.current.id;
    expect((await eventsPost(authed("events", paired.deviceToken, { contactId, event: "dialing" }))).status).toBe(200);
    const ended = await eventsPost(authed("events", paired.deviceToken, { contactId, event: "disconnected", causeCode: 1, causeLabel: "Sem sinal da operadora" }));
    const body = await ended.json() as { state: { completed: number; current: { id: string }; lastCall: { autoOutcome: string } } };
    expect(body.state.completed).toBe(1);
    expect(body.state.lastCall.autoOutcome).toBe("no_answer");
    expect(body.state.current.id).not.toBe(contactId);
  });

  it("ligação atendida espera a classificação da web antes de seguir", async () => {
    const paired = await pairNew({ flagBypass: true });
    callAncoraSessionStore.setTestList(paired.scope, [{ name: "Ana", phone: "+5521999990000" }, { name: "Bia", phone: "+5521977776666" }]);
    const contactId = callAncoraSessionStore.getForBroker(paired.scope)?.current?.id ?? "";
    await eventsPost(authed("events", paired.deviceToken, { contactId, event: "dialing" }));
    await eventsPost(authed("events", paired.deviceToken, { contactId, event: "active" }));
    await eventsPost(authed("events", paired.deviceToken, { contactId, event: "disconnected", causeCode: 3 }));
    const waiting = callAncoraSessionStore.getForBroker(paired.scope);
    expect(waiting).toMatchObject({ awaitingClassification: true, completed: 0, current: { id: contactId } });
    const classified = callAncoraSessionStore.classify(paired.scope, "interested");
    expect(classified?.current?.id).not.toBe(contactId);
  });

  it("o celular registra o feedback da ligação atendida e a fila segue", async () => {
    const paired = await pairNew({ flagBypass: true });
    callAncoraSessionStore.setTestList(paired.scope, [{ name: "Ana", phone: "+5521999990000" }, { name: "Bia", phone: "+5521977776666" }]);
    const contactId = callAncoraSessionStore.getForBroker(paired.scope)?.current?.id ?? "";
    // Antes da ligação terminar não há o que classificar.
    expect((await classifyPost(authed("classify", paired.deviceToken, { outcome: "interested" }))).status).toBe(409);
    await eventsPost(authed("events", paired.deviceToken, { contactId, event: "dialing" }));
    await eventsPost(authed("events", paired.deviceToken, { contactId, event: "active" }));
    await eventsPost(authed("events", paired.deviceToken, { contactId, event: "disconnected", causeCode: 3 }));
    expect((await classifyPost(authed("classify", paired.deviceToken, { outcome: "talvez" }))).status).toBe(400);
    const response = await classifyPost(authed("classify", paired.deviceToken, { outcome: "interested" }));
    expect(response.status).toBe(200);
    const body = await response.json() as { state: { completed: number; current: { id: string } } };
    expect(body.state.completed).toBe(1);
    expect(body.state.current.id).not.toBe(contactId);
    expect(callAncoraSessionStore.getForBroker(paired.scope)?.interests.map((item) => item.id)).toContain(contactId);
    expect((await classifyPost(authed("classify", "token-inexistente-0000000000000000000000000", { outcome: "interested" }))).status).toBe(401);
  });

  it("pausa e retoma pelo celular", async () => {
    const paired = await pairNew();
    const paused = await (await controlPost(authed("control", paired.deviceToken, { action: "pause" }))).json() as { state: { paused: boolean } };
    expect(paused.state.paused).toBe(true);
    const resumed = await (await controlPost(authed("control", paired.deviceToken, { action: "resume" }))).json() as { state: { paused: boolean } };
    expect(resumed.state.paused).toBe(false);
  });

  it("reiniciar a sessão na web derruba o token do celular", async () => {
    const paired = await pairNew();
    callAncoraSessionStore.create(paired.scope, "Ana Souza");
    expect((await stateGet(authed("state", paired.deviceToken))).status).toBe(401);
  });

  async function testListSession(autoDial = false) {
    const paired = await pairNew({ flagBypass: true });
    callAncoraSessionStore.setTestList(paired.scope, [
      { name: "Ana", phone: "+5521999990000" },
      { name: "Bia", phone: "+5521977776666" },
    ]);
    if (autoDial) callAncoraSessionStore.setAutoDialEnabled(paired.scope, true);
    const contactId = callAncoraSessionStore.getForBroker(paired.scope)?.current?.id ?? "";
    const send = (body: Record<string, unknown>) => eventsPost(authed("events", paired.deviceToken, { contactId, ...body }));
    return { ...paired, contactId, send };
  }

  it("provável caixa postal (ACTIVE rápido): o app desliga e o servidor classifica sozinho", async () => {
    const s = await testListSession();
    await s.send({ event: "dialing" });
    await s.send({ event: "active" });
    const ended = await s.send({ event: "disconnected", causeCode: 2, autoOutcome: "voicemail", rule: "quick_active", dialToActiveMs: 1200 });
    const body = await ended.json() as { state: { completed: number; awaitingClassification: boolean; lastCall: { autoOutcome: string; rule: string; dialToActiveMs: number } } };
    expect(body.state.completed).toBe(1);
    expect(body.state.awaitingClassification).toBe(false);
    expect(body.state.lastCall).toMatchObject({ autoOutcome: "voicemail", rule: "quick_active", dialToActiveMs: 1200 });
  });

  it("tempo de toque esgotado: Não atendeu automático com a regra registrada", async () => {
    const s = await testListSession(true);
    await s.send({ event: "dialing" });
    await s.send({ event: "disconnected", causeCode: 2, autoOutcome: "no_answer", rule: "ring_timeout" });
    const snapshot = callAncoraSessionStore.getForBroker(s.scope);
    expect(snapshot?.lastOutcome).toEqual({ contactId: s.contactId, outcome: "no_answer", auto: true });
    expect(snapshot?.lastCall?.rule).toBe("ring_timeout");
    expect(snapshot?.countdown?.remainingSeconds).toBe(3);
  });

  it("corrige a classificação automática só durante a contagem", async () => {
    const s = await testListSession(true);
    await s.send({ event: "dialing" });
    await s.send({ event: "active" });
    await s.send({ event: "disconnected", autoOutcome: "voicemail", rule: "late_active" });
    const corrected = callAncoraSessionStore.reclassify(s.scope, "interested");
    expect(corrected?.lastOutcome).toEqual({ contactId: s.contactId, outcome: "interested", auto: false });
    expect(corrected?.interests.map((item) => item.id)).toEqual([s.contactId]);
    expect(callAncoraSessionStore.reclassify(s.scope, "not_interested")?.interests).toEqual([]);

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_000);
    expect(callAncoraSessionStore.reclassify(s.scope, "voicemail")).toBeNull();
  });

  it("web pede para o celular desligar como caixa postal", async () => {
    const s = await testListSession();
    expect(callAncoraSessionStore.requestVoicemailHangup(s.scope)).toBeNull();
    await s.send({ event: "dialing" });
    expect(callAncoraSessionStore.requestVoicemailHangup(s.scope)?.hangupRequested).toBe(true);
    const state = await (await stateGet(authed("state", s.deviceToken))).json() as { state: { hangupRequest: string | null } };
    expect(state.state.hangupRequest).toBe("voicemail");
    await s.send({ event: "disconnected", autoOutcome: "voicemail", rule: "manual_web" });
    expect(callAncoraSessionStore.getForBroker(s.scope)?.hangupRequested).toBe(false);
  });

  it("sessão pausada pela tela recusa o evento de discagem", async () => {
    const s = await testListSession();
    callAncoraSessionStore.pauseRunForBroker(s.scope);
    const response = await s.send({ event: "dialing" });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "paused" });
    callAncoraSessionStore.resumeRunForBroker(s.scope);
    expect((await s.send({ event: "dialing" })).status).toBe(200);
  });

  it("recusa discagem com versão diferente da do servidor", async () => {
    const s = await testListSession();
    const state = await (await stateGet(authed("state", s.deviceToken))).json() as { state: { version: number; runState: string } };
    expect(state.state.runState).toBe("running");
    const stale = await s.send({ event: "dialing", version: state.state.version - 1 });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "version_mismatch" });
    expect((await s.send({ event: "dialing", version: state.state.version })).status).toBe(200);
  });

  it("encerrar na web encerra a sessão e derruba o token do celular", async () => {
    const s = await testListSession();
    const ended = callAncoraSessionStore.endRunForBroker(s.scope);
    expect(ended).toMatchObject({ runState: "ended", status: "ended", current: null });
    expect((await stateGet(authed("state", s.deviceToken))).status).toBe(401);
  });

  it("encerrar no celular também derruba o token", async () => {
    const s = await testListSession();
    const response = await controlPost(authed("control", s.deviceToken, { action: "end" }));
    expect(response.status).toBe(200);
    expect(callAncoraSessionStore.getForBroker(s.scope)?.runState).toBe("ended");
    expect((await stateGet(authed("state", s.deviceToken))).status).toBe(401);
  });

  it("heartbeat: celular sem sinal há mais de 6 s aparece na web e segura a fila", async () => {
    const s = await testListSession(true);
    await stateGet(authed("state", s.deviceToken));
    expect(callAncoraSessionStore.getForBroker(s.scope)?.phone?.reachable).toBe(true);
    await s.send({ event: "dialing" });
    await s.send({ event: "disconnected", autoOutcome: "no_answer", rule: "ring_timeout" });

    const base = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(base + 7_000);
    const stale = callAncoraSessionStore.getForBroker(s.scope);
    expect(stale?.phone).toMatchObject({ reachable: false });
    expect(stale?.phone?.staleSeconds).toBeGreaterThanOrEqual(6);
    expect(stale?.current?.id).toBe(s.contactId);

    await stateGet(authed("state", s.deviceToken));
    const back = callAncoraSessionStore.getForBroker(s.scope);
    expect(back?.phone?.reachable).toBe(true);
    expect(back?.current?.id).not.toBe(s.contactId);
  });

  it("a versão só cresce", async () => {
    const s = await testListSession();
    const v1 = callAncoraSessionStore.getForBroker(s.scope)?.version ?? 0;
    callAncoraSessionStore.pauseRunForBroker(s.scope);
    const v2 = callAncoraSessionStore.getForBroker(s.scope)?.version ?? 0;
    callAncoraSessionStore.resumeRunForBroker(s.scope);
    const v3 = callAncoraSessionStore.getForBroker(s.scope)?.version ?? 0;
    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it("lista de teste só vale para sessão de admin/dev", () => {
    const broker = newSession();
    expect(callAncoraSessionStore.setTestList(broker.scope, [{ name: "X", phone: "+5521999990000" }])).toBeNull();
  });
});
