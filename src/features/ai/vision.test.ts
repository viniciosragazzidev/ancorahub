import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveVisionTarget } from "./vision";
import type { AiSettings } from "./types";

function settings(overrides: Partial<AiSettings> = {}): AiSettings {
  return {
    enabled: true,
    primaryProvider: "groq",
    primaryModel: "llama-3.3-70b-versatile",
    fallbackProvider: "none",
    fallbackModel: "",
    temperature: 0.7,
    maxTokens: 1024,
    systemPrompt: "x",
    ...overrides,
  };
}

afterEach(() => vi.unstubAllEnvs());

describe("resolveVisionTarget", () => {
  it("skips a text-only primary provider and uses Google when it has a key", () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(resolveVisionTarget(settings({ googleApiKey: "g" }), {})).toEqual({
      provider: "google",
      model: "gemini-2.0-flash",
    });
  });

  it("uses the primary provider and its model when it accepts images", () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    expect(
      resolveVisionTarget(settings({ primaryProvider: "google", primaryModel: "gemini-2.5-flash", googleApiKey: "g" }), {}),
    ).toEqual({ provider: "google", model: "gemini-2.5-flash" });
  });

  it("honours the explicit vision provider and model", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(
      resolveVisionTarget(settings({ openaiApiKey: "o", googleApiKey: "g" }), { provider: "openai", model: "gpt-4o" }),
    ).toEqual({ provider: "openai", model: "gpt-4o" });
  });

  it("does not carry an explicit model over to another provider", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");
    expect(
      resolveVisionTarget(settings({ googleApiKey: "g" }), { provider: "openai", model: "gpt-4o" }),
    ).toEqual({ provider: "google", model: "gemini-2.0-flash" });
  });

  it("ignores an explicit provider that cannot read images", () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    expect(resolveVisionTarget(settings({ googleApiKey: "g" }), { provider: "groq", model: "llama" })?.provider).toBe("google");
  });

  it("returns null when no provider with a key can read images", () => {
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(resolveVisionTarget(settings({ groqApiKey: "k" }), {})).toBeNull();
  });
});
