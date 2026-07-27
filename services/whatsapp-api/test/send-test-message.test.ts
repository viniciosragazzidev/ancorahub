import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

const saved = { ...process.env };

function configure() {
  process.env.WHATSAPP_API_INTERNAL_TOKEN = "internal-test-token";
  process.env.WHATSAPP_REVIEW_ENABLED = "false";
  process.env.META_WHATSAPP_REVIEW_ACCESS_TOKEN = "meta-test-token";
  process.env.META_WHATSAPP_REVIEW_PHONE_NUMBER_ID = "123456789";
  process.env.META_WHATSAPP_GRAPH_API_VERSION = "v25.0";
}

test.after(() => { process.env = saved; });

test("requires server-to-server authentication before reading a review request", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "POST", url: "/api/integrations/whatsapp/send-test-message", payload: { to: "5521999999999", message: "Teste" } });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("rejects a review request when the reversible review capability is disabled", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "POST", url: "/api/integrations/whatsapp/send-test-message", headers: { "x-corretop-internal-token": "internal-test-token" }, payload: { to: "5521999999999", message: "Teste" } });
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.json(), { success: false, error: { code: "REVIEW_DISABLED", message: "O envio de revisão está desativado." } });
  await app.close();
});
