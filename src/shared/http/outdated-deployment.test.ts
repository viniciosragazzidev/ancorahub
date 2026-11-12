import { describe, expect, it } from "vitest";

import { isOutdatedDeploymentError } from "./outdated-deployment";

describe("isOutdatedDeploymentError", () => {
  it("reconhece as mensagens reais do Next depois de um deploy", () => {
    expect(isOutdatedDeploymentError(new Error('Server Action "00dd03ccc7cf432d372d75d2a5ea45c8e9d6b67c76" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action'))).toBe(true);
    expect(isOutdatedDeploymentError(new Error("An unexpected response was received from the server."))).toBe(true);
    expect(isOutdatedDeploymentError(new Error("Failed to find Server Action. This request might be from an older or newer deployment."))).toBe(true);
  });

  it("não confunde com outros erros", () => {
    expect(isOutdatedDeploymentError(new Error("WAHA_TIMEOUT"))).toBe(false);
    expect(isOutdatedDeploymentError("Número inválido")).toBe(false);
    expect(isOutdatedDeploymentError(null)).toBe(false);
  });
});
