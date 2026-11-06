import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";
import { buildWebhookConfig, WahaClient, WAHA_WEBHOOK_TOKEN_HEADER } from "../src/integrations/waha/client.js";

const saved = { ...process.env };
test.afterEach(() => { process.env = { ...saved }; });

function baseEnv() {
  process.env.WHATSAPP_API_INTERNAL_TOKEN = "internal-test-token";
  process.env.WAHA_BASE_URL = "http://localhost:3000";
  process.env.WAHA_API_KEY = "test-waha-key";
  process.env.CRM_WEBHOOK_URL = "https://crm.example.test/api/webhooks/waha";
  process.env.WAHA_RELAY_SHARED_SECRET = "relay-shared-secret";
}

async function post(headers: Record<string, string> = {}) {
  const originalFetch = globalThis.fetch;
  let forwarded = 0;
  globalThis.fetch = async () => {
    forwarded += 1;
    return new Response(JSON.stringify({ accepted: true }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/internal/webhooks/waha",
      headers,
      payload: { event: "message", session: "s1", payload: {} },
    });
    return { status: response.statusCode, forwarded };
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
}

test("fase 2: recusa webhook sem o token e não repassa ao CRM", async () => {
  baseEnv();
  process.env.WAHA_WEBHOOK_TOKEN = "segredo-do-webhook";
  process.env.WAHA_WEBHOOK_TOKEN_REQUIRED = "true";
  assert.deepEqual(await post(), { status: 401, forwarded: 0 });
  assert.deepEqual(await post({ [WAHA_WEBHOOK_TOKEN_HEADER]: "errado" }), { status: 401, forwarded: 0 });
});

test("fase 2: aceita e repassa webhook com o token certo", async () => {
  baseEnv();
  process.env.WAHA_WEBHOOK_TOKEN = "segredo-do-webhook";
  process.env.WAHA_WEBHOOK_TOKEN_REQUIRED = "true";
  const result = await post({ [WAHA_WEBHOOK_TOKEN_HEADER]: "segredo-do-webhook" });
  assert.equal(result.status, 200);
  assert.ok(result.forwarded >= 1);
});

test("exigir o token sem configurá-lo falha fechado", async () => {
  baseEnv();
  delete process.env.WAHA_WEBHOOK_TOKEN;
  process.env.WAHA_WEBHOOK_TOKEN_REQUIRED = "true";
  assert.deepEqual(await post(), { status: 503, forwarded: 0 });
});

test("fase 1: sem exigência, webhook antigo sem token continua passando", async () => {
  baseEnv();
  process.env.WAHA_WEBHOOK_TOKEN = "segredo-do-webhook";
  delete process.env.WAHA_WEBHOOK_TOKEN_REQUIRED;
  const result = await post();
  assert.equal(result.status, 200);
});

test("configuração do webhook leva o token no cabeçalho quando definido", () => {
  assert.deepEqual(buildWebhookConfig("https://api.example/internal/webhooks/waha", { WAHA_WEBHOOK_TOKEN: "t" } as NodeJS.ProcessEnv).customHeaders, [
    { name: WAHA_WEBHOOK_TOKEN_HEADER, value: "t" },
  ]);
  assert.equal("customHeaders" in buildWebhookConfig("https://x", {} as NodeJS.ProcessEnv), false);
});

test("refreshSessionWebhooks preserva o resto da config e aplica o cabeçalho", async () => {
  process.env.WAHA_WEBHOOK_TOKEN = "t2";
  process.env.WHATSAPP_HOOK_URL = "https://api.example/internal/webhooks/waha";
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if ((init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([{ name: "s1", config: { proxy: { server: "p" }, webhooks: [{ url: "old" }] } }]), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  const client = new WahaClient({ baseUrl: "http://waha", apiKey: "k", healthTimeoutMs: 1000 }, fetchFn);
  const results = await client.refreshSessionWebhooks();
  assert.deepEqual(results, [{ name: "s1", outcome: "updated" }]);
  const put = calls.find((call) => call.method === "PUT");
  assert.ok(put);
  const body = put.body as { config: { proxy: unknown; webhooks: Array<{ url: string; customHeaders?: unknown }> } };
  assert.deepEqual(body.config.proxy, { server: "p" });
  assert.equal(body.config.webhooks[0].url, "https://api.example/internal/webhooks/waha");
  assert.deepEqual(body.config.webhooks[0].customHeaders, [{ name: WAHA_WEBHOOK_TOKEN_HEADER, value: "t2" }]);
});
