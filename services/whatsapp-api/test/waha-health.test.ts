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

test("GET /health continua independente do WAHA", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });
  await app.close();
});

test("GET /internal/waha/health sem Bearer interno retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({ method: "GET", url: "/internal/waha/health" });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.service, "waha");
  assert.equal(body.status, "unauthorized");
  await app.close();
});

test("GET /internal/waha/health com Bearer inválido retorna 401", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/health",
    headers: { "x-corretop-internal-token": "wrong-token" },
  });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.status, "unauthorized");
  await app.close();
});

test("GET /internal/waha/health sem WAHA_BASE_URL retorna 503", async () => {
  delete process.env.WAHA_BASE_URL;
  process.env.WHATSAPP_API_INTERNAL_TOKEN = "internal-test-token";
  process.env.WAHA_API_KEY = "test-waha-key";
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/health",
    headers: { "x-corretop-internal-token": "internal-test-token" },
  });
  assert.equal(response.statusCode, 503);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.equal(body.service, "waha");
  await app.close();
});

test("GET /internal/waha/health com WAHA configurado retorna resposta controlada", async () => {
  configure();
  const app = buildApp();
  const response = await app.inject({
    method: "GET",
    url: "/internal/waha/health",
    headers: { "x-corretop-internal-token": "internal-test-token" },
  });
  // WAHA provavelmente não está rodando localmente, então esperamos 503 ou 504
  // Mas o ponto é: a rota responde de forma controlada
  assert.ok([200, 503, 504].includes(response.statusCode));
  const body = response.json();
  assert.equal(body.ok, response.statusCode === 200);
  assert.equal(body.service, "waha");
  await app.close();
});
