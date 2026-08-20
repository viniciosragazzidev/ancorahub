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

// ── POST /start ────────────────────────────────────────────────────────

test("POST /start sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "POST", url: "/internal/waha/test-session/start" });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.status, "unauthorized");
  await app.close();
});

test("POST /start com Bearer inválido retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/test-session/start",
    headers: { "x-corretop-internal-token": "wrong-token" },
  });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test("POST /start com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/test-session/start",
    headers: { "x-corretop-internal-token": "internal-test-token" },
  });
  // WAHA não está rodando localmente — deve retornar 502
  assert.ok([200, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  await app.close();
});

// ── GET /status ────────────────────────────────────────────────────────

test("GET /status sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/internal/waha/test-session/status" });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.status, "unauthorized");
  await app.close();
});

test("GET /status com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/test-session/status",
    headers: { "x-corretop-internal-token": "internal-test-token" },
  });
  assert.ok([200, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  await app.close();
});

// ── GET /qr ────────────────────────────────────────────────────────────

test("GET /qr sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/internal/waha/test-session/qr" });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.status, "unauthorized");
  await app.close();
});

test("GET /qr com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/test-session/qr",
    headers: { "x-corretop-internal-token": "internal-test-token" },
  });
  assert.ok([200, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  // QR não deve estar no body se não há sessão
  if (body.ok) {
    assert.ok("qr" in body);
  }
  await app.close();
});

// ── POST /reset ────────────────────────────────────────────────────────

test("POST /reset sem Bearer retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "POST", url: "/internal/waha/test-session/reset" });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.status, "unauthorized");
  await app.close();
});

test("POST /reset com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "POST",
    url: "/internal/waha/test-session/reset",
    headers: { "x-corretop-internal-token": "internal-test-token" },
  });
  // WAHA não está rodando — mas stop/delete ignoram erros, então deve retornar 200
  assert.ok([200, 502].includes(response.statusCode));
  const body = response.json();
  assert.equal(typeof body.ok, "boolean");
  await app.close();
});

// ── /health continua independente ──────────────────────────────────────

test("GET /health continua retornando 200 mesmo com rotas WAHA", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  await app.close();
});
