import assert from "node:assert/strict";
import test from "node:test";

import { WahaClient, wahaMediaFilePath } from "../src/integrations/waha/client.js";
import { WahaClientError } from "../src/integrations/waha/types.js";

const config = { baseUrl: "http://waha:3000", apiKey: "k", healthTimeoutMs: 5_000 };

test("wahaMediaFilePath: keeps only WAHA /api/files paths, whatever host the link names", () => {
  assert.equal(wahaMediaFilePath("http://localhost:3000/api/files/ancora-broker-1/ABC.oga"), "/api/files/ancora-broker-1/ABC.oga");
  assert.equal(wahaMediaFilePath("/api/files/s/x.jpeg"), "/api/files/s/x.jpeg");
  assert.equal(wahaMediaFilePath("http://evil.example/api/sessions"), null);
  assert.equal(wahaMediaFilePath("http://waha:3000/api/files/../sessions"), null);
  assert.equal(wahaMediaFilePath("not a url at all \u0000"), null);
});

test("WahaClient.downloadMediaFile: fetches from its own WAHA with the API key and returns the bytes", async () => {
  const calls: Array<{ url: string; key: string | null }> = [];
  const client = new WahaClient(config, (async (url: string, init?: RequestInit) => {
    calls.push({ url, key: new Headers(init?.headers).get("x-api-key") });
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/ogg; codecs=opus" } });
  }) as typeof fetch);
  const file = await client.downloadMediaFile("http://localhost:3000/api/files/s/a.oga");
  assert.deepEqual(calls, [{ url: "http://waha:3000/api/files/s/a.oga", key: "k" }]);
  assert.equal(file.contentType, "audio/ogg");
  assert.deepEqual([...file.body], [1, 2, 3]);
});

test("WahaClient.downloadMediaFile: rejects foreign paths and oversized files", async () => {
  const client = new WahaClient(config, (async () => new Response(new Uint8Array(10), { status: 200 })) as typeof fetch);
  await assert.rejects(client.downloadMediaFile("http://waha:3000/api/sessions"), (error: unknown) => error instanceof WahaClientError && error.code === "WAHA_MEDIA_INVALID_PATH");
  await assert.rejects(client.downloadMediaFile("/api/files/s/big.mp4", 5), (error: unknown) => error instanceof WahaClientError && error.code === "WAHA_MEDIA_TOO_LARGE");
});
