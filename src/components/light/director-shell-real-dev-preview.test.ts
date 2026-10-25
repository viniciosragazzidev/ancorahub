import { describe, expect, it } from "vitest";

import { isDirectorShellRealDevPreview } from "./director-shell-real-dev-preview";

describe("isDirectorShellRealDevPreview", () => {
  it("aceita somente a rota exata em desenvolvimento", () => {
    expect(isDirectorShellRealDevPreview("/dev/diretor-shell-real", "development")).toBe(true);
    expect(isDirectorShellRealDevPreview("/dev/diretor-shell-real/filho", "development")).toBe(false);
    expect(isDirectorShellRealDevPreview("/dev/diretor-shell-real", "production")).toBe(false);
  });
});
