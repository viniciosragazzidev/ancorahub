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

test("GET /status preserva erro de autenticação do WAHA", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("Unauthorized", { status: 401 })) as typeof globalThis.fetch;
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/internal/waha/connections/waha_auth123/status",
      headers: AUTH_HEADERS,
    });
    assert.equal(response.statusCode, 502);
    assert.equal(response.json().error, "WAHA_UNAUTHORIZED");
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});

test("POST /disconnect preserva o código seguro do provider para o CRM", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("Unauthorized", { status: 401 })) as typeof globalThis.fetch;
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/internal/waha/connections/waha_abc123/disconnect",
      headers: AUTH_HEADERS,
    });
    assert.equal(response.statusCode, 502);
    assert.equal(response.json().error, "WAHA_UNAUTHORIZED");
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});

test("POST /recover concorrente para sessão FAILED recria somente uma sessão", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  let exists = true;
  let status = "FAILED";
  let createCalls = 0;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    const method = init?.method ?? "GET";
    if (target.endsWith("/api/sessions/waha_recover123") && method === "GET") {
      return exists
        ? new Response(JSON.stringify({ name: "waha_recover123", status }), { status: 200 })
        : new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }
    if (target.endsWith("/api/sessions/waha_recover123/stop")) {
      return new Response(JSON.stringify({ error: "invalid state" }), { status: 400 });
    }
    if (target.endsWith("/api/sessions/waha_recover123/logout")) {
      return new Response(JSON.stringify({ error: "invalid state" }), { status: 400 });
    }
    if (target.endsWith("/api/sessions/waha_recover123") && method === "DELETE") {
      exists = false;
      return new Response(null, { status: 204 });
    }
    if (target.endsWith("/api/sessions/") && method === "POST") {
      createCalls++;
      exists = true;
      status = "STOPPED";
      return new Response(JSON.stringify({}), { status: 201 });
    }
    if (target.endsWith("/api/sessions/waha_recover123/start")) {
      status = "SCAN_QR_CODE";
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }) as typeof globalThis.fetch;

  const app = buildApp();
  try {
    const [first, second] = await Promise.all([
      app.inject({ method: "POST", url: "/internal/waha/connections/waha_recover123/recover", headers: AUTH_HEADERS }),
      app.inject({ method: "POST", url: "/internal/waha/connections/waha_recover123/recover", headers: AUTH_HEADERS }),
    ]);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.json().status, "WAITING_QR");
    assert.equal(second.json().status, "WAITING_QR");
    assert.equal(createCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
});

test("POST /reconnect invalida QR anterior antes de criar a sessão nova", async () => {
  configure();
  const originalFetch = globalThis.fetch;
  let exists = true;
  let status = "SCAN_QR_CODE";
  let deleteCalls = 0;
  let createCalls = 0;
  const calls: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${target}`);
    if (target.endsWith("/api/sessions/waha_reconnect123") && method === "GET") {
      return exists
        ? new Response(JSON.stringify({ name: "waha_reconnect123", status }), { status: 200 })
        : new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }
    if (target.endsWith("/api/sessions/waha_reconnect123/stop")) {
      status = "STOPPED";
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (target.endsWith("/api/sessions/waha_reconnect123/logout")) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (target.endsWith("/api/sessions/waha_reconnect123") && method === "DELETE") {
      deleteCalls++;
      exists = false;
      return new Response(null, { status: 204 });
    }
    if (target.endsWith("/api/sessions/") && method === "POST") {
      createCalls++;
      assert.equal(exists, false, "a sessão antiga deve ser removida antes da criação");
      exists = true;
      status = "STOPPED";
      return new Response(JSON.stringify({}), { status: 201 });
    }
    if (target.endsWith("/api/sessions/waha_reconnect123/start")) {
      status = "SCAN_QR_CODE";
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (target.includes("/api/waha_reconnect123/auth/qr")) {
      return new Response(JSON.stringify({ data: "new-qr" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }) as typeof globalThis.fetch;

  const app = buildApp();
  try {
    const [first, second] = await Promise.all([
      app.inject({ method: "POST", url: "/internal/waha/connections/waha_reconnect123/reconnect", headers: AUTH_HEADERS }),
      app.inject({ method: "POST", url: "/internal/waha/connections/waha_reconnect123/reconnect", headers: AUTH_HEADERS }),
    ]);
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.json().status, "WAITING_QR");
    assert.equal(first.json().qr, "new-qr");
    assert.equal(second.json().status, "WAITING_QR");
    assert.equal(deleteCalls, 1);
    assert.equal(createCalls, 1);
    assert.ok(calls.findIndex((call) => call.startsWith("DELETE ")) < calls.findIndex((call) => call.endsWith("/api/sessions/")), "delete deve ocorrer antes de create");
  } finally {
    globalThis.fetch = originalFetch;
    await app.close();
  }
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
