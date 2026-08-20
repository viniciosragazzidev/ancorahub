import assert from "node:assert/strict";
import test from "node:test";

import { buildApp } from "../src/app.js";

const saved = { ...process.env };

function configure() {
  process.env.WHATSAPP_API_INTERNAL_TOKEN = "internal-test-token";
  process.env.WAHA_BASE_URL = "http://localhost:3000";
  process.env.WAHA_API_KEY = "test-waha-key";
}

test.after(() => { process.env = saved; });

const AUTH_HEADERS = { "x-corretop-internal-token": "internal-test-token" };

// ── POST /internal/waha/messages/text ─────────────────────────────────

test("POST /messages/text sem Bearer retorna 401", async () => {
  configure();
  const app = await buildApp();
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/messages/text",
    payload: { sessionName: "waha_test", chatId: "5521999999999", text: "Olá" },
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("POST /messages/text com Bearer inválido retorna 401", async () => {
  configure();
  const app = await buildApp();
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/messages/text",
    headers: { "x-corretop-internal-token": "wrong-token" },
    payload: { sessionName: "waha_test", chatId: "5521999999999", text: "Olá" },
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("POST /messages/text com chatId inválido retorna 400", async () => {
  configure();
  const app = await buildApp();
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/messages/text",
    headers: AUTH_HEADERS,
    payload: { sessionName: "waha_test", chatId: "abc1234567", text: "Olá" },
  });
  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "INVALID_CHAT_ID");
  await app.close();
});

test("POST /messages/text com texto vazio retorna 400", async () => {
  configure();
  const app = await buildApp();
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/messages/text",
    headers: AUTH_HEADERS,
    payload: { sessionName: "waha_test", chatId: "5521999999999", text: "" },
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("POST /messages/text com body válido retorna resposta controlada", async () => {
  configure();
  const app = await buildApp();
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/messages/text",
    headers: AUTH_HEADERS,
    payload: {
      sessionName: "waha_abcdef1234567890",
      chatId: "5521999999999",
      text: "Teste outbound 20.6",
      idempotencyKey: "outbound:test:12345678901234",
    },
  });
  // WAHA is not running in test, so 502 is expected
  assert.ok([400, 502].includes(response.statusCode), `Expected 400 or 502, got ${response.statusCode}`);
  const body = response.json();
  assert.equal(body.ok, false);
  await app.close();
});

test("POST /messages/text com idempotencyKey opcional", async () => {
  configure();
  const app = await buildApp();
  await app.ready();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/messages/text",
    headers: AUTH_HEADERS,
    payload: {
      sessionName: "waha_abcdef1234567890",
      chatId: "5521999999999",
      text: "Sem idempotency key",
    },
  });
  assert.ok([400, 502].includes(response.statusCode));
  await app.close();
});

test("GET /health continua retornando 200 mesmo com rotas de envio", async () => {
  configure();
  const app = await buildApp();
  await app.ready();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  await app.close();
});
