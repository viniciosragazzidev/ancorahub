import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { buildApp } from "../src/app.js";

/**
 * Fluxo de pareamento ponta a ponta do lado Fastify contra um WAHA simulado:
 * criar sessão → QR (que rotaciona) → scan → conectado, mais as garantias que
 * impedem regressões conhecidas (nada de logout ao reabrir, QR nunca velho).
 */

type FakeWaha = {
  url: string;
  calls: string[];
  session: { status: string; me?: { id: string } } | null;
  qrCounter: number;
  /** Status em que uma sessão recém-criada aparece (o WAHA real passa por STARTING). */
  createStatus: string;
  close(): Promise<void>;
};

async function startFakeWaha(): Promise<FakeWaha> {
  const fake: FakeWaha = {
    url: "",
    calls: [],
    session: null,
    qrCounter: 0,
    createStatus: "STARTING",
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };

  const server: Server = createServer((req, res) => {
    const path = (req.url ?? "").split("?")[0];
    const method = req.method ?? "GET";
    fake.calls.push(`${method} ${path}`);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (path === "/api/sessions/" && method === "POST") {
      fake.session = { status: fake.createStatus };
      return json(201, {});
    }
    if (path === "/api/sessions/s1" && method === "GET") {
      return fake.session ? json(200, { name: "s1", ...fake.session }) : json(404, {});
    }
    if (path === "/api/sessions/s1" && method === "DELETE") {
      fake.session = null;
      return json(200, {});
    }
    if (path === "/api/sessions/s1/start") {
      if (fake.session) fake.session.status = "STARTING";
      return json(200, {});
    }
    if (path === "/api/sessions/s1/stop") return json(200, {});
    if (path === "/api/sessions/s1/logout") return json(200, {});
    if (path === "/api/s1/auth/qr") {
      if (fake.session?.status !== "SCAN_QR_CODE") return json(422, {});
      fake.qrCounter++;
      return json(200, { mimetype: "image/png", data: `QR-${fake.qrCounter}` });
    }
    return json(404, {});
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  fake.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return fake;
}

const AUTH = { "x-corretop-internal-token": "flow-token" };
const saved = { ...process.env };
test.after(() => { process.env = saved; });

async function withFlow(run: (ctx: { waha: FakeWaha; get: (path: string) => Promise<Record<string, unknown>>; post: (path: string, body?: unknown) => Promise<{ code: number; body: Record<string, unknown> }> }) => Promise<void>) {
  const waha = await startFakeWaha();
  process.env.WHATSAPP_API_INTERNAL_TOKEN = "flow-token";
  process.env.WAHA_BASE_URL = waha.url;
  process.env.WAHA_API_KEY = "waha-key";
  process.env.WHATSAPP_HOOK_URL = "https://api.exemplo.com/internal/webhooks/waha";
  const app = buildApp();
  try {
    await run({
      waha,
      get: async (path) => (await app.inject({ method: "GET", url: path, headers: AUTH })).json(),
      post: async (path, body) => {
        const response = await app.inject({ method: "POST", url: path, headers: AUTH, payload: body as object | undefined });
        return { code: response.statusCode, body: response.json() };
      },
    });
  } finally {
    await app.close();
    await waha.close();
  }
}

const CONNECT = { tenantId: "t1", userId: "u1", sessionName: "s1" };

test("pareamento completo: preparando → QR rotativo → pareando → conectado", async () => {
  await withFlow(async ({ waha, get, post }) => {
    const started = await post("/internal/waha/connections", CONNECT);
    assert.equal(started.code, 201);

    // Sessão subindo: sem QR, e o status bruto diferencia de "QR disponível".
    let state = await get("/internal/waha/connections/s1/state");
    assert.equal(state.providerStatus, "STARTING");
    assert.equal(state.qr, null);

    // WAHA pronto para leitura: QR chega na MESMA leitura de estado.
    waha.session!.status = "SCAN_QR_CODE";
    state = await get("/internal/waha/connections/s1/state");
    assert.equal(state.providerStatus, "SCAN_QR_CODE");
    assert.equal(state.qr, "QR-1");

    // Rotação: cada leitura devolve o QR atual do provider, nunca um cache.
    state = await get("/internal/waha/connections/s1/state");
    assert.equal(state.qr, "QR-2");

    // Celular leu o código: sai de SCAN_QR_CODE, QR deixa de existir.
    waha.session!.status = "STARTING";
    state = await get("/internal/waha/connections/s1/state");
    assert.equal(state.providerStatus, "STARTING");
    assert.equal(state.qr, null);

    // Vínculo concluído.
    waha.session = { status: "WORKING", me: { id: "5511999998821@c.us" } };
    state = await get("/internal/waha/connections/s1/state");
    assert.equal(state.status, "CONNECTED");
    assert.equal(state.phoneNumber, "5511999998821");
    assert.equal(state.qr, null);
  });
});

test("reabrir o dialog com a sessão já conectada reutiliza e NUNCA faz logout", async () => {
  await withFlow(async ({ waha, post }) => {
    waha.session = { status: "WORKING", me: { id: "5511999998821@c.us" } };
    const reopened = await post("/internal/waha/connections", CONNECT);
    assert.equal(reopened.code, 200);
    assert.equal(reopened.body.reused, true);
    assert.equal(reopened.body.status, "CONNECTED");
    assert.ok(!waha.calls.some((call) => call.includes("/logout") || call.startsWith("DELETE")), "desvincularia o aparelho do corretor");
    assert.ok(!waha.calls.includes("POST /api/sessions/"), "não pode criar outra sessão");
  });
});

test("reabrir com sessão em SCAN_QR_CODE reutiliza a sessão (mesmo QR continua válido)", async () => {
  await withFlow(async ({ waha, post }) => {
    waha.session = { status: "SCAN_QR_CODE" };
    const reopened = await post("/internal/waha/connections", CONNECT);
    assert.equal(reopened.body.reused, true);
    assert.ok(!waha.calls.some((call) => call.startsWith("DELETE") || call.includes("/stop")));
  });
});

test("gerar novo QR (reconnect) recria a sessão FAILED sem logout e devolve estado do provider", async () => {
  await withFlow(async ({ waha, post }) => {
    waha.session = { status: "FAILED" };
    // WAHA já entrega a sessão recriada em SCAN_QR_CODE: o QR vem na própria resposta.
    waha.createStatus = "SCAN_QR_CODE";
    const result = await post("/internal/waha/connections/s1/reconnect");
    assert.equal(result.code, 200);
    assert.ok(!waha.calls.some((call) => call.includes("/logout")), "sessão FAILED não tem vínculo a desfazer");
    assert.ok(waha.calls.includes("DELETE /api/sessions/s1"));
    assert.ok(waha.calls.includes("POST /api/sessions/"));
    assert.equal(result.body.providerStatus, "SCAN_QR_CODE");
    assert.equal(result.body.qr, "QR-1");
  });
});

test("sessão ausente no WAHA aparece como inexistente (CRM pode recriar)", async () => {
  await withFlow(async ({ get }) => {
    const state = await get("/internal/waha/connections/s1/state");
    assert.equal(state.ok, true);
    assert.equal(state.exists, false);
    assert.equal(state.status, "DISCONNECTED");
  });
});
