import assert from "node:assert/strict";
import test from "node:test";

import { WahaClient } from "../src/integrations/waha/client.js";
import { attachLidPhoneNumbers, clearLidCacheForTests } from "../src/integrations/waha/lid.js";

const inbound = (from: string, to = "5521900000000@c.us") => ({
  event: "message",
  session: "ancora-broker-1",
  payload: { id: "msg-1", from, to, fromMe: false, body: "Oi, tenho interesse" },
});

test("attachLidPhoneNumbers: adds the phone behind an @lid sender and keeps the original field", async () => {
  clearLidCacheForTests();
  const body = inbound("123456789012345@lid");
  const result = await attachLidPhoneNumbers(body, async (session, lid) => {
    assert.equal(session, "ancora-broker-1");
    assert.equal(lid, "123456789012345@lid");
    return "5521999428504@c.us";
  });
  assert.deepEqual(result, { from: true, to: false });
  assert.equal(body.payload.from, "123456789012345@lid");
  assert.deepEqual((body.payload as Record<string, unknown>)._ancora, { fromPn: "5521999428504@c.us" });
});

test("attachLidPhoneNumbers: leaves phone-addressed messages and non-message events alone", async () => {
  clearLidCacheForTests();
  let calls = 0;
  const resolver = async () => { calls += 1; return "5521999428504@c.us"; };
  const phoneAddressed = inbound("5521999428504@c.us");
  await attachLidPhoneNumbers(phoneAddressed, resolver);
  assert.equal((phoneAddressed.payload as Record<string, unknown>)._ancora, undefined);
  await attachLidPhoneNumbers({ event: "session.status", session: "s", payload: { from: "1@lid" } }, resolver);
  assert.equal(calls, 0);
});

test("attachLidPhoneNumbers: an unknown LID is forwarded unchanged and cached briefly", async () => {
  clearLidCacheForTests();
  let calls = 0;
  const resolver = async () => { calls += 1; return null; };
  const body = inbound("999999999999999@lid");
  assert.deepEqual(await attachLidPhoneNumbers(body, resolver, 1_000), { from: false, to: false });
  await attachLidPhoneNumbers(inbound("999999999999999@lid"), resolver, 2_000);
  assert.equal(calls, 1);
  assert.equal((body.payload as Record<string, unknown>)._ancora, undefined);
});

test("WahaClient.getPhoneForLid: reads pn from the WAHA lids endpoint and never throws", async () => {
  const requested: string[] = [];
  const client = new WahaClient({ baseUrl: "http://waha:3000", apiKey: "k", healthTimeoutMs: 5_000 }, (async (url: string) => {
    requested.push(url);
    return new Response(JSON.stringify({ lid: "123@lid", pn: "5521999428504@c.us" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch);
  assert.equal(await client.getPhoneForLid("ancora-broker-1", "123@lid"), "5521999428504@c.us");
  assert.equal(requested[0], "http://waha:3000/api/ancora-broker-1/lids/123%40lid");

  const failing = new WahaClient({ baseUrl: "http://waha:3000", apiKey: "k", healthTimeoutMs: 5_000 }, (async () => new Response("nope", { status: 404 })) as typeof fetch);
  assert.equal(await failing.getPhoneForLid("s", "123@lid"), null);
});
