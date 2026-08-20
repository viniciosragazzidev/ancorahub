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

// ── POST /connections ──────────────────────────────────────────────────

test("POST /connections sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/connections",
    payload: { tenantId: "t1", userId: "u1", sessionName: "waha_test123" },
  });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.status, "unauthorized");
  await app.close();
});

test("POST /connections com body inválido retorna 400", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/connections",
    headers: AUTH_HEADERS,
    payload: { tenantId: "t1" }, // missing userId e sessionName
  });
  assert.equal(response.statusCode, 400);
  await app.close();
});

test("POST /connections com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/connections",
    headers: AUTH_HEADERS,
    payload: { tenantId: "t1", userId: "u1", sessionName: "waha_abcdef1234567890" },
  });
  // WAHA não está rodando — deve retornar 502
  assert.ok([200, 201, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  await app.close();
});

// ── GET /connections/:id/status ────────────────────────────────────────

test("GET /status sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/connections/waha_abc123/status",
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("GET /status com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/connections/waha_abc123/status",
    headers: AUTH_HEADERS,
  });
  assert.ok([200, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  await app.close();
});

// ── GET /connections/:id/qr ────────────────────────────────────────────

test("GET /qr sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/connections/waha_abc123/qr",
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("GET /qr com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/connections/waha_abc123/qr",
    headers: AUTH_HEADERS,
  });
  assert.ok([200, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  await app.close();
});

// ── POST /connections/:id/disconnect ───────────────────────────────────

test("POST /disconnect sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/connections/waha_abc123/disconnect",
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("POST /disconnect com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/connections/waha_abc123/disconnect",
    headers: AUTH_HEADERS,
  });
  // WAHA não está rodando — mas stop/delete ignoram erros, deve retornar 200
  assert.ok([200, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  await app.close();
});

// ── /health continua independente ──────────────────────────────────────

test("GET /health continua retornando 200 mesmo com rotas de conexão", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  await app.close();
});
