// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserAvatar } from "./user-avatar";

const PHOTO = "/api/contacts/avatar?lead=lead-1";
let reveal: (() => void) | null = null;
let requested: string[] = [];

beforeEach(() => {
  requested = [];
  reveal = null;
  // The avatar loads its image in script: record every image source asked for.
  vi.stubGlobal("Image", class {
    set src(value: string) { requested.push(value); }
    addEventListener() {}
    removeEventListener() {}
  });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      reveal = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
    observe() {}
    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("UserAvatar photo near the screen", () => {
  it("asks for the photo only once the avatar is near the screen", () => {
    render(<UserAvatar seed="Ana" name="Ana" photoUrl={PHOTO} photoWhenVisible />);
    expect(requested.some((src) => src.includes(PHOTO))).toBe(false);

    act(() => reveal?.());
    expect(requested.some((src) => src.includes(PHOTO))).toBe(true);
  });

  it("asks for the photo right away without the option", () => {
    render(<UserAvatar seed="Ana" name="Ana" photoUrl={PHOTO} />);
    expect(requested.some((src) => src.includes(PHOTO))).toBe(true);
  });
});
