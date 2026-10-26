// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ArcScopeProvider } from "./arc-scope-context";
import { useDirectorLitePage } from "./use-director-lite-page";

const pathname = vi.hoisted(() => ({ current: "/leads" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

function wrap(enabled: boolean) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <ArcScopeProvider enabled={enabled}>{children}</ArcScopeProvider>;
  };
}

describe("useDirectorLitePage", () => {
  it("só liga com a chave ligada e a rota fora do opt-out", () => {
    pathname.current = "/dashboard";
    expect(renderHook(() => useDirectorLitePage(), { wrapper: wrap(true) }).result.current).toBe(true);
    expect(renderHook(() => useDirectorLitePage(), { wrapper: wrap(false) }).result.current).toBe(false);
    pathname.current = "/mensagens";
    expect(renderHook(() => useDirectorLitePage(), { wrapper: wrap(true) }).result.current).toBe(false);
  });

  it("sem provider fica desligado", () => {
    pathname.current = "/dashboard";
    expect(renderHook(() => useDirectorLitePage()).result.current).toBe(false);
  });
});
