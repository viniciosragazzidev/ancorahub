import { describe, expect, it } from "vitest";

import { isDirectorF2DevPreview } from "./director-f2-dev-preview";

describe("isDirectorF2DevPreview", () => {
  it("identifies only the exact local preview path", () => {
    expect(isDirectorF2DevPreview("/dev/diretor-f2-preview", "development")).toBe(true);
    expect(isDirectorF2DevPreview("/dev/diretor-f2-preview/child", "development")).toBe(false);
    expect(isDirectorF2DevPreview("/dev/diretor-f2-preview", "production")).toBe(false);
  });
});
