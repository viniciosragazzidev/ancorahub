import assert from "node:assert/strict";
import test from "node:test";

import { WahaClient, resolveWebhookUrl } from "../src/integrations/waha/client.js";
import { WahaClientError, normalizeWahaStatus } from "../src/integrations/waha/types.js";

const config = {
  baseUrl: "http://waha:3000",
  apiKey: "test-api-key",
  healthTimeoutMs: 5_000,
};

// ── normalizeWahaStatus ────────────────────────────────────────────────

test("normalizeWahaStatus: WORKING → CONNECTED", () => {
  assert.equal(normalizeWahaStatus("WORKING"), "CONNECTED");
});

for (const status of ["CONNECTED", "READY", "AUTHENTICATED", "OPEN", "ONLINE"]) {
  test(`normalizeWahaStatus: ${status} → CONNECTED`, () => {
    assert.equal(normalizeWahaStatus(status), "CONNECTED");
  });
}

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

// ── WahaClientError ──────────────────────────────────────────────────

test("WahaClientError preserva providerStatusCode", () => {
  const err = new WahaClientError("WAHA_INTERNAL_ERROR", 502, "test", 409);
  assert.equal(err.providerStatusCode, 409);
  assert.equal(err.code, "WAHA_INTERNAL_ERROR");
  assert.equal(err.statusCode, 502);
});

test("WahaClientError providerStatusCode é opcional", () => {
  const err = new WahaClientError("WAHA_TIMEOUT", 504, "timeout");
  assert.equal(err.providerStatusCode, undefined);
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
  assert.equal(result.status, "unavailable");
  assert.equal(result.error, "WAHA_UNAUTHORIZED");
});

test("getMessages: consulta histórico limitado usando o chatId normalizado", async () => {
  let requestedUrl = "";
  const client = new WahaClient(config, mockFetch(async (url) => {
    requestedUrl = url;
    return new Response(JSON.stringify({ messages: [{ id: { _serialized: "true_5511999999999@c.us_abc" }, fromMe: true }] }), { status: 200 });
  }));

  const messages = await client.getMessages("broker-session", "5511999999999", 250);

  assert.match(requestedUrl, /\/api\/broker-session\/chats\/5511999999999%40c\.us\/messages\?limit=100/);
  assert.equal(messages.length, 1);
});

test("getChats: lista conversas limitadas para reconciliação", async () => {
  const requested: string[] = [];
  const client = new WahaClient({ baseUrl: "http://waha.test", apiKey: "key", healthTimeoutMs: 1000 }, async (url) => {
    requested.push(String(url));
    return new Response(JSON.stringify({ chats: [{ id: "5521998765432@c.us" }] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  const chats = await client.getChats("broker-session", 20);
  assert.deepEqual(chats, [{ id: "5521998765432@c.us" }]);
  assert.match(requested[0], /\/api\/broker-session\/chats\?limit=20/);
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
  const result = await client.health();
  assert.ok(typeof result.ok === "boolean");
});

// ── WahaClient.sendText ───────────────────────────────────────────────

test("sendText: resolve telefone para chatId @lid antes de enviar", async () => {
  const requests: Array<{ url: string; body?: unknown }> = [];
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    requests.push({
      url,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });

    if (url.includes("/api/contacts/check-exists")) {
      return new Response(JSON.stringify({ exists: true, chatId: "248309876846833@lid" }), { status: 200 });
    }
    if (url.endsWith("/api/sendText")) {
      return new Response(JSON.stringify({ id: "message-123" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }));

  const result = await client.sendText("waha_test", "5521999999999", "Olá");

  assert.equal(result.messageId, "message-123");
  assert.match(requests[0]?.url ?? "", /phone=5521999999999/);
  assert.deepEqual(requests[1]?.body, {
    session: "waha_test",
    chatId: "248309876846833@lid",
    text: "Olá",
  });
});

test("sendText: não envia para telefone quando o WAHA não resolve o destinatário", async () => {
  const requests: string[] = [];
  const client = new WahaClient(config, mockFetch(async (url) => {
    requests.push(url);
    return new Response(JSON.stringify({ exists: false }), { status: 200 });
  }));

  await assert.rejects(
    () => client.sendText("waha_test", "5521999999999", "Olá"),
    (error: unknown) => error instanceof WahaClientError && error.code === "WAHA_RECIPIENT_NOT_FOUND",
  );
  assert.equal(requests.length, 1);
  assert.match(requests[0] ?? "", /check-exists/);
});

// ── WahaClient.getSession ──────────────────────────────────────────────

test("getSession: sessão existente → retorna WahaSession", async () => {
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/api/sessions/test123")) {
      return new Response(JSON.stringify({ name: "test123", status: "WORKING", me: { id: "5511999999999@c.us" } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }));
  const session = await client.getSession("test123");
  assert.ok(session);
  assert.equal(session.status, "CONNECTED");
  assert.equal(session.displayPhoneNumber, "5511999999999");
});

test("getSession: 404 → null (sessão não existe)", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }));
  const session = await client.getSession("nonexistent");
  assert.equal(session, null);
});

test("getSession: 500 → lança erro (não retorna null)", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
  }));
  await assert.rejects(
    () => client.getSession("test123"),
    (err: unknown) => err instanceof WahaClientError && err.providerStatusCode === 500,
  );
});

test("getSession: indisponibilidade de rede → lança WAHA_UNAVAILABLE (não simula sessão ausente)", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    throw new TypeError("fetch failed");
  }));
  await assert.rejects(
    () => client.getSession("test123"),
    (err: unknown) => err instanceof WahaClientError && err.code === "WAHA_UNAVAILABLE",
  );
});

// ── WahaClient.createSession ──────────────────────────────────────────

test("createSession: nova sessão → retorna status inicial", async () => {
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    if (url.includes("/api/sessions/") && init?.method === "POST" && !url.includes("/start")) {
      return new Response(JSON.stringify({ name: "new123", status: "STARTING" }), { status: 201 });
    }
    if (url.includes("/api/sessions/new123") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ name: "new123", status: "SCAN_QR_CODE" }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }));
  const session = await client.createSession("new123");
  assert.equal(session.status, "WAITING_QR");
});

test("createSession: 409 (sessão existe) → retorna sessão existente", async () => {
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    if (url.includes("/api/sessions/") && init?.method === "POST" && !url.includes("/start")) {
      return new Response(JSON.stringify({ error: "already exists" }), { status: 409 });
    }
    if (url.includes("/api/sessions/exist409") && (!init?.method || init.method === "GET")) {
      return new Response(JSON.stringify({ name: "exist409", status: "WORKING", me: { id: "5511888888888@c.us" } }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }));
  const session = await client.createSession("exist409");
  assert.ok(session);
  assert.equal(session.status, "CONNECTED");
});

function failedSessionRecoveryClient(deleteStatus = 200) {
  let exists = true;
  let status = "FAILED";
  let createCalls = 0;
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    const method = init?.method ?? "GET";
    if (url.includes("/api/sessions/recover-me") && method === "GET") {
      return exists
        ? new Response(JSON.stringify({ name: "recover-me", status }), { status: 200 })
        : new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }
    if (url.includes("/api/sessions/recover-me/stop")) return new Response(JSON.stringify({ error: "invalid state" }), { status: 400 });
    if (url.includes("/api/sessions/recover-me/logout")) return new Response(JSON.stringify({ error: "invalid state" }), { status: 400 });
    if (url.endsWith("/api/sessions/recover-me") && method === "DELETE") {
      exists = false;
      return new Response(JSON.stringify({}), { status: deleteStatus });
    }
    if (url.endsWith("/api/sessions/") && method === "POST") {
      createCalls++;
      exists = true;
      status = "STOPPED";
      return new Response(JSON.stringify({}), { status: 201 });
    }
    if (url.includes("/api/sessions/recover-me/start")) {
      status = "SCAN_QR_CODE";
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }));
  return { client, getCreateCalls: () => createCalls };
}

test("recoverFailedSession: stop 400 continua com delete e recriação", async () => {
  const { client, getCreateCalls } = failedSessionRecoveryClient();
  const result = await client.recoverFailedSession("recover-me");
  assert.equal(result.session.status, "WAITING_QR");
  assert.equal(getCreateCalls(), 1);
  // stop ignorado + delete; sem logout (FAILED não tem vínculo a desfazer)
  assert.deepEqual(result.cleanup.map((item) => item.operation), ["stop", "delete"]);
  assert.deepEqual(result.cleanup.map((item) => item.outcome), ["ignored", "completed"]);
});

test("recoverFailedSession: delete 404 considera sessão ausente e recria", async () => {
  const { client, getCreateCalls } = failedSessionRecoveryClient(404);
  const result = await client.recoverFailedSession("recover-me");
  assert.equal(result.session.status, "WAITING_QR");
  assert.equal(getCreateCalls(), 1);
  assert.equal(result.cleanup.at(-1)?.outcome, "ignored");
  assert.equal(result.cleanup.at(-1)?.providerStatusCode, 404);
});

test("disconnect cleanup: stop e logout 422 não impedem a remoção da sessão", async () => {
  const calls: string[] = [];
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    const target = String(url);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${target}`);
    if (target.endsWith("/stop") || target.endsWith("/logout")) {
      return new Response(JSON.stringify({ error: "invalid state" }), { status: 422 });
    }
    if (target.endsWith("/api/sessions/disconnect-me") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }));

  const stop = await client.stopSession("disconnect-me");
  const deletion = await client.deleteSession("disconnect-me");

  assert.deepEqual(stop, { operation: "stop", outcome: "ignored", providerStatusCode: 422, normalizedError: "WAHA_INTERNAL_ERROR" });
  assert.deepEqual(deletion.map((item) => item.outcome), ["ignored", "completed"]);
  assert.equal(calls.length, 3);
});

test("disconnect cleanup: stop e logout 425 (not in valid state) não impedem a remoção da sessão", async () => {
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    const target = String(url);
    const method = init?.method ?? "GET";
    if (target.endsWith("/stop") || target.endsWith("/logout")) {
      // WAHA responde 425 quando logout é chamado em sessão que não está WORKING.
      return new Response(JSON.stringify({ error: "not in valid state" }), { status: 425 });
    }
    if (target.endsWith("/api/sessions/disconnect-425") && method === "DELETE") {
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }));

  const stop = await client.stopSession("disconnect-425");
  const deletion = await client.deleteSession("disconnect-425");

  assert.deepEqual(stop, { operation: "stop", outcome: "ignored", providerStatusCode: 425, normalizedError: "WAHA_INTERNAL_ERROR" });
  assert.deepEqual(deletion.map((item) => item.outcome), ["ignored", "completed"]);
});

test("disconnect cleanup: delete 425/422 continua sendo falha observável", async () => {
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    const target = String(url);
    const method = init?.method ?? "GET";
    if (target.endsWith("/stop") || target.endsWith("/logout")) {
      return new Response(null, { status: 204 });
    }
    if (method === "DELETE") {
      return new Response(JSON.stringify({ error: "not in valid state" }), { status: 425 });
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }));

  await assert.rejects(
    () => client.deleteSession("delete-425"),
    (err: unknown) => err instanceof WahaClientError && err.providerStatusCode === 425,
  );
});

// ── WahaClient.getQr ──────────────────────────────────────────────────

test("getQr: sessão em WAITING_QR com JSON data → retorna base64", async () => {
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/api/sessions/qrtest") && !url.includes("/auth")) {
      return new Response(JSON.stringify({ name: "qrtest", status: "SCAN_QR_CODE" }), { status: 200 });
    }
    if (url.includes("/auth/qr")) {
      return new Response(JSON.stringify({ data: "iVBORw0KGgo=" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }));
  const qr = await client.getQr("qrtest");
  assert.equal(qr, "iVBORw0KGgo=");
});

test("getQr: sessão em WAITING_QR com imagem binária → retorna base64", async () => {
  const fakePng = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/api/sessions/qrbin") && !url.includes("/auth")) {
      return new Response(JSON.stringify({ name: "qrbin", status: "SCAN_QR_CODE" }), { status: 200 });
    }
    if (url.includes("/auth/qr")) {
      return new Response(fakePng, {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    return new Response("not found", { status: 404 });
  }));
  const qr = await client.getQr("qrbin");
  assert.equal(typeof qr, "string");
  assert.ok(qr.length > 0);
  // Verify it's valid base64
  assert.ok(Buffer.from(qr, "base64").length > 0);
});

test("getQr: sessão CONNECTED → lança QR_NOT_READY", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response(JSON.stringify({ name: "connected", status: "WORKING", me: { id: "5511999999999@c.us" } }), { status: 200 });
  }));
  await assert.rejects(
    () => client.getQr("connected"),
    (err: unknown) => err instanceof WahaClientError && err.code === "QR_NOT_READY",
  );
});

test("getQr: sessão não existe → lança SESSION_NOT_FOUND", async () => {
  const client = new WahaClient(config, mockFetch(async () => {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }));
  await assert.rejects(
    () => client.getQr("ghost"),
    (err: unknown) => err instanceof WahaClientError && err.code === "SESSION_NOT_FOUND",
  );
});

test("getQr: QR data vazio → lança QR_EXPIRED", async () => {
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/api/sessions/emptyqr") && !url.includes("/auth")) {
      return new Response(JSON.stringify({ name: "emptyqr", status: "SCAN_QR_CODE" }), { status: 200 });
    }
    if (url.includes("/auth/qr")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }));
  await assert.rejects(
    () => client.getQr("emptyqr"),
    (err: unknown) => err instanceof WahaClientError && err.code === "QR_EXPIRED",
  );
});

// ── WahaClient.getConnectionState ─────────────────────────────────────

test("getConnectionState: SCAN_QR_CODE devolve status bruto e QR na mesma leitura", async () => {
  let sessionReads = 0;
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/auth/qr")) {
      return new Response(JSON.stringify({ data: "QR-ATUAL" }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/api/sessions/state1")) {
      sessionReads++;
      return new Response(JSON.stringify({ name: "state1", status: "SCAN_QR_CODE" }), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }));
  const state = await client.getConnectionState("state1");
  assert.deepEqual(state, { exists: true, status: "WAITING_QR", providerStatus: "SCAN_QR_CODE", phoneNumber: null, qr: "QR-ATUAL" });
  assert.equal(sessionReads, 1, "o QR não pode reler a sessão");
});

test("getConnectionState: STARTING não busca QR (pareamento em andamento)", async () => {
  let qrCalls = 0;
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/auth/qr")) { qrCalls++; return new Response("{}", { status: 200 }); }
    return new Response(JSON.stringify({ name: "state2", status: "STARTING" }), { status: 200 });
  }));
  const state = await client.getConnectionState("state2");
  assert.equal(state.providerStatus, "STARTING");
  assert.equal(state.status, "WAITING_QR");
  assert.equal(state.qr, null);
  assert.equal(qrCalls, 0);
});

test("getConnectionState: WORKING devolve telefone e nenhum QR", async () => {
  const client = new WahaClient(config, mockFetch(async () =>
    new Response(JSON.stringify({ name: "state3", status: "WORKING", me: { id: "5511999999999@c.us" } }), { status: 200 })));
  const state = await client.getConnectionState("state3");
  assert.deepEqual(state, { exists: true, status: "CONNECTED", providerStatus: "WORKING", phoneNumber: "5511999999999", qr: null });
});

test("getConnectionState: sessão ausente não é erro", async () => {
  const client = new WahaClient(config, mockFetch(async () => new Response("{}", { status: 404 })));
  const state = await client.getConnectionState("ghost");
  assert.equal(state.exists, false);
  assert.equal(state.status, "DISCONNECTED");
});

test("getConnectionState: falha transitória ao ler o QR mantém o status", async () => {
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/auth/qr")) return new Response("boom", { status: 500 });
    return new Response(JSON.stringify({ name: "state4", status: "SCAN_QR_CODE" }), { status: 200 });
  }));
  const state = await client.getConnectionState("state4");
  assert.equal(state.providerStatus, "SCAN_QR_CODE");
  assert.equal(state.qr, null);
});

test("getConnectionState: chave de API inválida no QR é propagada", async () => {
  const client = new WahaClient(config, mockFetch(async (url) => {
    if (url.includes("/auth/qr")) return new Response("no", { status: 401 });
    return new Response(JSON.stringify({ name: "state5", status: "SCAN_QR_CODE" }), { status: 200 });
  }));
  await assert.rejects(
    () => client.getConnectionState("state5"),
    (err: unknown) => err instanceof WahaClientError && err.code === "WAHA_UNAUTHORIZED",
  );
});

// ── WahaClient.reconnectSession ───────────────────────────────────────

function reconnectClient(initialStatus: string | null) {
  const calls: string[] = [];
  let status = initialStatus;
  const client = new WahaClient(config, mockFetch(async (url, init) => {
    const method = init?.method ?? "GET";
    const path = new URL(url).pathname;
    calls.push(`${method} ${path}`);
    if (path === "/api/sessions/rc" && method === "GET") {
      return status === null ? new Response("{}", { status: 404 }) : new Response(JSON.stringify({ name: "rc", status }), { status: 200 });
    }
    if (path.endsWith("/stop") || path.endsWith("/logout")) return new Response("{}", { status: 200 });
    if (path === "/api/sessions/rc" && method === "DELETE") { status = null; return new Response("{}", { status: 200 }); }
    if (path === "/api/sessions/" && method === "POST") { status = "STARTING"; return new Response("{}", { status: 201 }); }
    return new Response("{}", { status: 404 });
  }));
  return { client, calls };
}

test("reconnectSession: sessão em pareamento é recriada SEM logout", async () => {
  const { client, calls } = reconnectClient("SCAN_QR_CODE");
  const result = await client.reconnectSession("rc");
  assert.ok(!calls.some((call) => call.endsWith("/logout")), "logout desvincularia o aparelho sem necessidade");
  assert.ok(calls.includes("DELETE /api/sessions/rc"));
  assert.ok(calls.includes("POST /api/sessions/"));
  assert.equal(result.session.providerStatus, "STARTING");
});

test("reconnectSession: sessão CONNECTED faz logout antes de remover", async () => {
  const { client, calls } = reconnectClient("WORKING");
  await client.reconnectSession("rc");
  assert.ok(calls.indexOf("POST /api/sessions/rc/logout") < calls.indexOf("DELETE /api/sessions/rc"));
});

test("reconnectSession: sessão inexistente só cria (sem stop/delete)", async () => {
  const { client, calls } = reconnectClient(null);
  await client.reconnectSession("rc");
  assert.ok(!calls.some((call) => call.includes("/stop") || call.startsWith("DELETE")));
  assert.ok(calls.includes("POST /api/sessions/"));
});

// ── resolveWebhookUrl ─────────────────────────────────────────────────

test("resolveWebhookUrl: WHATSAPP_HOOK_URL tem precedência, depois INTERNAL_API_URL", () => {
  assert.equal(resolveWebhookUrl({ WHATSAPP_HOOK_URL: "https://api.exemplo.com/hook", INTERNAL_API_URL: "https://x" }), "https://api.exemplo.com/hook");
  assert.equal(resolveWebhookUrl({ INTERNAL_API_URL: "https://api.exemplo.com/" }), "https://api.exemplo.com/internal/webhooks/waha");
});
