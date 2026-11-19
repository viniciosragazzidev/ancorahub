import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const flag = vi.hoisted(() => ({ value: "true" }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: vi.fn(async () => flag.value) }));

import { CALL_ANCORA_PAIR_TTL_MS, callAncoraSessionStore } from "@/features/call-ancora/session-store";
import { POST as pairPost } from "./pair/route";
import { GET as stateGet } from "./state/route";
import { POST as eventsPost } from "./events/route";
import { POST as controlPost } from "./control/route";

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

  it("nunca expõe o número de contato de demonstração (não discável)", async () => {
    const paired = await pairNew();
    const response = await stateGet(authed("state", paired.deviceToken));
    const text = await response.text();
    const body = JSON.parse(text) as { state: { current: { dialable: boolean; phone: string | null }; next: { phoneMasked: string | null } } };
    expect(body.state.current).toMatchObject({ dialable: false, phone: null });
    expect(body.state.next.phoneMasked).toBeNull();
    expect(text).not.toMatch(/0000-00\d\d/);
  });

  it("recusa evento de ligação para contato não discável", async () => {
    const paired = await pairNew();
    const response = await eventsPost(authed("events", paired.deviceToken, { contactId: paired.pairBody.state.current.id, event: "dialing" }));
    expect(response.status).toBe(422);
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

  it("lista de teste só vale para sessão de admin/dev", () => {
    const broker = newSession();
    expect(callAncoraSessionStore.setTestList(broker.scope, [{ name: "X", phone: "+5521999990000" }])).toBeNull();
  });
});
