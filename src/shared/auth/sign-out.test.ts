// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/shared/auth/client", () => auth);

import { signOutAndGoToLogin } from "./sign-out";

const replace = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("signOutAndGoToLogin", () => {
  it("encerra a sessão e só depois vai para o login com navegação completa", async () => {
    vi.stubGlobal("location", { ...window.location, replace });
    const order: string[] = [];
    auth.signOut.mockImplementation(async () => { order.push("signOut"); });
    replace.mockImplementation(() => order.push("login"));

    await signOutAndGoToLogin();

    expect(order).toEqual(["signOut", "login"]);
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("vai para o login mesmo quando o servidor não responde", async () => {
    vi.stubGlobal("location", { ...window.location, replace });
    auth.signOut.mockRejectedValue(new Error("offline"));

    await signOutAndGoToLogin();

    expect(replace).toHaveBeenCalledWith("/login");
  });
});
