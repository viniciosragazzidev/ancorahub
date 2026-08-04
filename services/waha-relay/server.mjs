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

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/health") {
    const raw = "";
    if (!validSignature(request.headers, raw)) return respond(response, 401, { errorCode: "invalid_signature" });
    return respond(response, 200, { status: "ok", sessions: [] });
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
