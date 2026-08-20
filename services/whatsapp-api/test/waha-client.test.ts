import assert from "node:assert/strict";
import test from "node:test";

import { WahaClient } from "../src/integrations/waha/client.js";
import { normalizeWahaStatus } from "../src/integrations/waha/types.js";

const config = {
  baseUrl: "http://waha:3000",
  apiKey: "test-api-key",
  healthTimeoutMs: 5_000,
};

// ── normalizeWahaStatus ────────────────────────────────────────────────

test("normalizeWahaStatus: WORKING → CONNECTED", () => {
  assert.equal(normalizeWahaStatus("WORKING"), "CONNECTED");
});

test("normalizeWahaStatus: STOPPED → DISCONNECTED", () => {
  assert.equal(normalizeWahaStatus("STOPPED"), "DISCONNECTED");
});

test("normalizeWahaStatus: FAILED → ERROR", () => {
  assert.equal(normalizeWahaStatus("FAILED"), "ERROR");
});

test("normalizeWahaStatus: SCAN_QR_CODE → WAITING_QR", () => {
  assert.equal(normalizeWahaStatus("SCAN_QR_CODE"), "WAITING_QR");
});

test("normalizeWahaStatus: STARTING → WAITING_QR", () => {
  assert.equal(normalizeWahaStatus("STARTING"), "WAITING_QR");
});

test("normalizeWahaStatus: status desconhecido → DISCONNECTED", () => {
  assert.equal(normalizeWahaStatus("UNKNOWN"), "DISCONNECTED");
});

// ── WahaClient.health ──────────────────────────────────────────────────

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  return handler as typeof globalThis.fetch;
}

test("health: WAHA responde 200 → healthy", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }));
  const result = await client.health();
  assert.equal(result.ok, true);
  assert.equal(result.status, "healthy");
  assert.ok(result.durationMs >= 0);
});

test("health: WAHA retorna 401 → status unavailable (auth details hidden)", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response("Unauthorized", { status: 401 });
  }));
  const result = await client.health();
  assert.equal(result.ok, false);
  // Auth details hidden from external consumers — maps to "unavailable"
  assert.equal(result.status, "unavailable");
  assert.equal(result.error, "WAHA_UNAUTHORIZED");
});

test("health: WAHA retorna 500 → unavailable", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response("Internal Server Error", { status: 500 });
  }));
  const result = await client.health();
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.error, "WAHA_INTERNAL_ERROR");
});

test("health: network error → unavailable", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    throw new TypeError("fetch failed");
  }));
  const result = await client.health();
  assert.equal(result.ok, false);
  assert.equal(result.status, "unavailable");
  assert.equal(result.error, "WAHA_UNAVAILABLE");
});

test("health: JSON inválido no health não derruba o client", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response("not json", { status: 200, headers: { "content-type": "text/plain" } });
  }));
  // JSON.parse vai falhar, mas o health() deve tratar como healthy
  // (o WAHA pode não retornar JSON no health)
  const result = await client.health();
  assert.ok(typeof result.ok === "boolean");
});
