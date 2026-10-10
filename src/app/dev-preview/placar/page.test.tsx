import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); } }));
vi.mock("./preview", () => ({ RankingPreview: () => null }));
import Page from "./page";
afterEach(() => vi.unstubAllEnvs());
it.each(["production", "test"])("returns 404 in %s before rendering any fixture", async (environment) => {
  vi.stubEnv("NODE_ENV", environment);
  await expect(Page({ searchParams: Promise.resolve({ state: "full" }) })).rejects.toThrow("not_found");
});
it("renders a requested fixture state without auth in development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  expect((await Page({ searchParams: Promise.resolve({ state: "pending" }) })).props.state).toBe("pending");
});
