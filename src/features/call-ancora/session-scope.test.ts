import { describe, expect, it } from "vitest";

import { callAncoraSessionOwnerId } from "./session-scope";

describe("proprietário da sessão do Call Âncora", () => {
  it("usa a identidade autenticada do admin durante Ver como", () => {
    expect(callAncoraSessionOwnerId({ userId: "broker-real", viewAs: { adminUserId: "admin-real" } }, "admin-real"))
      .toBe("admin-real");
  });

  it("mantém a identidade do próprio corretor fora de Ver como", () => {
    expect(callAncoraSessionOwnerId({ userId: "broker-real" }, "broker-real"))
      .toBe("broker-real");
  });
});
