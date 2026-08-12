import { describe, expect, it } from "vitest";

import { isNavigationPrefetch } from "@/shared/http/navigation-prefetch";

describe("isNavigationPrefetch", () => {
  it("identifies App Router speculative prefetches", () => {
    const headers = new Headers({ "next-router-prefetch": "1" });

    expect(isNavigationPrefetch(headers)).toBe(true);
  });

  it("keeps a clicked navigation on the normal authorization path", () => {
    const headers = new Headers();

    expect(isNavigationPrefetch(headers)).toBe(false);
  });
});
