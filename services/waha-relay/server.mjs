import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

const port = Number(process.env.PORT ?? 8080);
const sharedSecret = process.env.WAHA_RELAY_SHARED_SECRET;
const wahaUrl = process.env.WAHA_API_BASE_URL?.replace(/\/$/, "");
const wahaKey = process.env.WAHA_API_KEY;
const dataFile = process.env.RELAY_IDEMPOTENCY_FILE ?? "/data/idempotency.json";

if (!sharedSecret || !wahaUrl || !wahaKey) throw new Error("WAHA relay requires WAHA_RELAY_SHARED_SECRET, WAHA_API_BASE_URL and WAHA_API_KEY.");

function signature(timestamp, nonce, body) {
  return createHmac("sha256", sharedSecret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

function validSignature(headers, raw) {
  const timestamp = headers["x-ancora-timestamp"];
  const nonce = headers["x-ancora-nonce"];
  const received = headers["x-ancora-signature"];
  if (typeof timestamp !== "string" || typeof nonce !== "string" || typeof received !== "string") return false;
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000) return false;
  const expected = Buffer.from(signature(timestamp, nonce, raw), "hex");
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && actual.length > 0 && timingSafeEqual(actual, expected);
}

async function readIdempotency() {
  try { return JSON.parse(await readFile(dataFile, "utf8")); } catch { return {}; }
}

async function writeIdempotency(entries) {
  await mkdir(new URL(".", `file://${dataFile}`).pathname, { recursive: true }).catch(() => undefined);
  const temporary = `${dataFile}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(entries), "utf8");
  await rename(temporary, dataFile);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function respond(response, status, data) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(data));
}

async function waha(path, options = {}) {
  const response = await fetch(`${wahaUrl}${path}`, {
    ...options,
    headers: { "x-api-key": wahaKey, ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`waha_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function sessionStatus(value) {
  const status = String(value?.status ?? value?.session?.status ?? "").toUpperCase();
  if (status === "WORKING") return "active";
  if (status === "STOPPED") return "paused";
  if (status === "FAILED") return "error";
  if (status === "SCAN_QR_CODE" || status === "STARTING") return "connecting";
  return "offline";
}

async function sessionState(sessionId, includeQr = true) {
  const session = await waha(`/api/sessions/${encodeURIComponent(sessionId)}`);
  const status = sessionStatus(session);
  let qrCode = null;
  if (includeQr && status === "connecting") {
    const qr = await waha(`/api/${encodeURIComponent(sessionId)}/auth/qr?format=image`, { headers: { accept: "application/json" } }).catch(() => null);
    qrCode = typeof qr?.data === "string" ? qr.data : null;
  }
  const me = status === "active"
    ? await waha(`/api/sessions/${encodeURIComponent(sessionId)}/me`).catch(() => null)
    : null;
  const displayPhoneNumber = typeof me?.id === "string" ? me.id.replace(/@.+$/, "") : null;
  return { sessionId, status, displayPhoneNumber, qrCode };
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/health") {
    const raw = "";
    if (!validSignature(request.headers, raw)) return respond(response, 401, { errorCode: "invalid_signature" });
    return respond(response, 200, { status: "ok", sessions: [] });
  }
  if (request.method === "POST" && request.url === "/v1/sessions") {
    const raw = await readBody(request);
    if (!validSignature(request.headers, raw)) return respond(response, 401, { errorCode: "invalid_signature" });
    const payload = JSON.parse(raw || "{}");
    if (!/^[a-z0-9-]{8,120}$/.test(payload?.sessionId ?? "")) return respond(response, 400, { errorCode: "invalid_request" });
    try {
      await waha("/api/sessions/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: payload.sessionId }) }).catch(async (error) => {
        if (error.status !== 409) throw error;
      });
      await waha(`/api/sessions/${encodeURIComponent(payload.sessionId)}/start`, { method: "POST", headers: { "content-type": "application/json" } }).catch(() => null);
      return respond(response, 200, await sessionState(payload.sessionId));
    } catch { return respond(response, 502, { errorCode: "waha_unavailable" }); }
  }
  const sessionMatch = request.url?.match(/^\/v1\/sessions\/([a-z0-9-]+)(?:\/(pause|resume))?$/);
  if (sessionMatch) {
    const raw = request.method === "GET" ? "" : await readBody(request);
    if (!validSignature(request.headers, raw)) return respond(response, 401, { errorCode: "invalid_signature" });
    const [, sessionId, operation] = sessionMatch;
    try {
      if (request.method === "POST" && operation === "pause") await waha(`/api/sessions/${sessionId}/stop`, { method: "POST", headers: { "content-type": "application/json" } });
      else if (request.method === "POST" && operation === "resume") await waha(`/api/sessions/${sessionId}/start`, { method: "POST", headers: { "content-type": "application/json" } });
      else if (request.method === "DELETE" && !operation) { await waha(`/api/sessions/${sessionId}/logout`, { method: "POST", headers: { "content-type": "application/json" } }).catch(() => null); await waha(`/api/sessions/${sessionId}`, { method: "DELETE" }); return respond(response, 200, { sessionId, status: "offline", displayPhoneNumber: null, qrCode: null }); }
      else if (request.method !== "GET") return respond(response, 405, { errorCode: "method_not_allowed" });
      return respond(response, 200, await sessionState(sessionId));
    } catch { return respond(response, 502, { errorCode: "waha_unavailable" }); }
  }
  if (request.method !== "POST" || request.url !== "/v1/messages") return respond(response, 404, { errorCode: "not_found" });
  const raw = await readBody(request);
  if (!validSignature(request.headers, raw)) return respond(response, 401, { errorCode: "invalid_signature" });
  let payload;
  try { payload = JSON.parse(raw); } catch { return respond(response, 400, { errorCode: "invalid_json" }); }
  if (!payload?.idempotencyKey || !payload?.sessionId || !/^\d{10,15}$/.test(payload.destination ?? "") || typeof payload.body !== "string") {
    return respond(response, 400, { errorCode: "invalid_request" });
  }
  const entries = await readIdempotency();
  if (entries[payload.idempotencyKey]) return respond(response, 200, entries[payload.idempotencyKey]);
  try {
    const upstream = await fetch(`${wahaUrl}/api/sendText`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": wahaKey },
      body: JSON.stringify({ session: payload.sessionId, chatId: `${payload.destination}@c.us`, text: payload.body }),
      signal: AbortSignal.timeout(15_000),
    });
    const upstreamBody = await upstream.json().catch(() => null);
    if (!upstream.ok) return respond(response, 502, { errorCode: `waha_${upstream.status}` });
    const messageId = upstreamBody?.id?._serialized ?? upstreamBody?.id ?? upstreamBody?.messageId;
    if (!messageId || typeof messageId !== "string") return respond(response, 502, { errorCode: "waha_missing_message_id" });
    const result = { messageId };
    entries[payload.idempotencyKey] = result;
    const keys = Object.keys(entries);
    if (keys.length > 10_000) for (const key of keys.slice(0, keys.length - 10_000)) delete entries[key];
    await writeIdempotency(entries);
    return respond(response, 202, result);
  } catch (error) {
    console.error("relay_send_failed", { requestId: payload.requestId, reason: error instanceof Error ? error.name : "unknown" });
    return respond(response, 502, { errorCode: "waha_unavailable" });
  }
});

server.listen(port, "0.0.0.0", () => console.info(`WAHA relay listening on ${port}`));
