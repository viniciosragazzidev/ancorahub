import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

describe("PWA cache policy", () => {
  it("never sends App Router flight requests through a cache strategy", async () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    const handlers = new Map<string, (event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void>();
    const cacheMatch = vi.fn();
    const networkFetch = vi.fn(async () => new Response("fresh flight"));
    let responsePromise: Promise<Response> | undefined;

    vm.runInNewContext(worker, {
      URL,
      Response,
      caches: {
        keys: vi.fn(async () => []),
        match: cacheMatch,
        open: vi.fn(async () => ({ addAll: vi.fn(), put: vi.fn() })),
      },
      console,
      fetch: networkFetch,
      self: {
        addEventListener: (name: string, handler: (event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void) => handlers.set(name, handler),
        clients: { claim: vi.fn(), matchAll: vi.fn(async () => []) },
        location: { origin: "https://crm.test" },
        registration: { getNotifications: vi.fn(async () => []) },
        skipWaiting: vi.fn(),
      },
    });

    handlers.get("fetch")?.({
      request: new Request("https://crm.test/dashboard?_rsc=flight", { headers: { RSC: "1" } }),
      respondWith: (response) => { responsePromise = response; },
    });

    await expect(responsePromise).resolves.toHaveProperty("ok", true);
    expect(networkFetch).toHaveBeenCalledTimes(1);
    expect(cacheMatch).not.toHaveBeenCalled();
  });
});
