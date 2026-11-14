// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/motion/interface-motion-provider", () => ({ useInterfaceMotionEnabled: () => false }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("motion/react", async (importOriginal) => ({ ...(await importOriginal<typeof import("motion/react")>()), useAnimate: () => [{ current: null }, () => ({ stop: () => {} })] }));

import { MASCOT_PLACEMENTS } from "./mascot-placements";
import { MascotSlot, setMascotPreviewAll } from "./mascot-slot";

afterEach(() => {
  cleanup();
  setMascotPreviewAll(false);
  vi.unstubAllEnvs();
});

describe("MascotSlot", () => {
  it("draws nothing while the placement is off, so the area stays as it was", () => {
    expect(MASCOT_PLACEMENTS.empty.enabled).toBe(false);
    const { container } = render(<MascotSlot placement="empty" />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the mascot with the placement's state and size when previewing all placements in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = render(<MascotSlot placement="error" />);
    act(() => setMascotPreviewAll(true));
    const box = container.querySelector("[data-mascot-state]") as HTMLElement;
    expect(box.getAttribute("data-mascot-state")).toBe("error");
    expect(box.style.height).toBe(`${MASCOT_PLACEMENTS.error.size}px`);
  });

  it("ignores the preview switch outside development", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { container } = render(<MascotSlot placement="error" />);
    act(() => setMascotPreviewAll(true));
    expect(container.querySelector("[data-mascot-state]")).toBeNull();
  });
});
