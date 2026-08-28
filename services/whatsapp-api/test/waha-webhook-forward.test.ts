import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { buildApp } from "../src/app.js";

const saved = { ...process.env };

test.after(() => { process.env = saved; });

test("encaminha evento WAHA ao CRM com a assinatura HMAC exigida pelo webhook", async () => {
  process.env.WHATSAPP_API_INTERNAL_TOKEN = "internal-test-token";
  process.env.WAHA_BASE_URL = "http://localhost:3000";
  process.env.WAHA_API_KEY = "test-waha-key";
  process.env.CRM_WEBHOOK_URL = "https://crm.example.test/api/webhooks/waha";
  process.env.WAHA_RELAY_SHARED_SECRET = "relay-shared-secret";

  const originalFetch = globalThis.fetch;
  let forwardedHeaders: Record<string, string> | undefined;
  let forwardedBody: string | undefined;
  globalThis.fetch = async (_url, init) => {
    forwardedHeaders = init?.headers as Record<string, string>;
    forwardedBody = init?.body as string;
    return new Response(JSON.stringify({ accepted: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/internal/webhooks/waha",
      payload: {
        eventId: "evt-1",
        type: "message.inbound",
        sessionId: "waha_test",
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(forwardedBody, JSON.stringify({ eventId: "evt-1", type: "message.inbound", sessionId: "waha_test" }));
    assert.ok(forwardedHeaders?.["x-ancora-timestamp"]);
    assert.ok(forwardedHeaders?.["x-ancora-nonce"]);
    const expected = createHmac("sha256", "relay-shared-secret")
      .update(`${forwardedHeaders!["x-ancora-timestamp"]}.${forwardedHeaders!["x-ancora-nonce"]}.${forwardedBody}`)
      .digest("hex");
    assert.equal(forwardedHeaders?.["x-ancora-signature"], expected);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});
