import { describe, expect, it } from "vitest";

import { isCallAncoraMobileSessionEndedStatus } from "./mobile-session";

describe("status da sessão móvel do Call Âncora", () => {
  it.each([401, 403])("encerra a consulta para HTTP %i", (status) => {
    expect(isCallAncoraMobileSessionEndedStatus(status)).toBe(true);
  });

  it.each([200, 400, 409, 500, 503])("mantém a consulta para HTTP %i", (status) => {
    expect(isCallAncoraMobileSessionEndedStatus(status)).toBe(false);
  });
});
