import { afterEach, describe, expect, it, vi } from "vitest";

import { getExternalQuoteBaseUrl } from "./external-quote-config";

afterEach(() => vi.unstubAllEnvs());

describe("external quote configuration", () => {
  it("accepts only http(s) provider URLs", () => {
    vi.stubEnv("EXTERNAL_QUOTE_APP_URL", "https://cotador.exemplo.test/quote");
    expect(getExternalQuoteBaseUrl()?.toString()).toBe("https://cotador.exemplo.test/quote");
  });

  it("rejects missing or unsafe provider URLs", () => {
    vi.stubEnv("EXTERNAL_QUOTE_APP_URL", "javascript:alert(1)");
    expect(getExternalQuoteBaseUrl()).toBeNull();
    vi.stubEnv("EXTERNAL_QUOTE_APP_URL", "");
    expect(getExternalQuoteBaseUrl()).toBeNull();
  });
});
