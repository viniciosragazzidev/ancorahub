import { describe, expect, it } from "vitest";

import { isDirectorLiteRouteOptedOut } from "./director-lite-routes";

describe("acesso de rota ao Call Âncora", () => {
  it("mantém a demonstração fora do Diretor Lite", () => {
    expect(isDirectorLiteRouteOptedOut("/call-ancora")).toBe(true);
  });
});
