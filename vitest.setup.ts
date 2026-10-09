import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// server-only lives inside next/dist/compiled/server-only and is resolved
// through Next.js internal module resolution. Vitest can't find it by bare
// import, so we mock it as a no-op.
vi.mock("server-only", () => ({}));

// Mock motion/react to avoid animation complexity in tests
vi.mock("motion/react", () => ({
  motion: new Proxy({}, { get: (_target, property) => String(property) }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  MotionConfig: ({ children }: { children: React.ReactNode }) => children,
  LayoutGroup: ({ children }: { children: React.ReactNode }) => children,
  useAnimation: () => ({ start: vi.fn(), stop: vi.fn(), set: vi.fn() }),
  useReducedMotion: () => false,
  useMotionValue: (initial: unknown) => ({
    get: () => initial,
    set: vi.fn(),
    jump: vi.fn(),
    stop: vi.fn(),
    isAnimating: () => false,
    on: () => () => {},
  }),
  useMotionValueEvent: () => {},
  useTransform: (valueOrFn: unknown, maybeFn?: (value: unknown) => unknown) => {
    if (typeof valueOrFn === "function") return (valueOrFn as () => unknown)();
    if (typeof maybeFn === "function") {
      const value = valueOrFn instanceof Array
        ? valueOrFn.map((entry) => (entry && typeof entry === "object" && "get" in entry ? (entry as { get: () => unknown }).get() : entry))
        : valueOrFn && typeof valueOrFn === "object" && "get" in valueOrFn
          ? (valueOrFn as { get: () => unknown }).get()
          : valueOrFn;
      return maybeFn(value) ?? "";
    }
    return valueOrFn;
  },
  usePresence: () => [true, vi.fn()] as const,
  useIsPresent: () => true,
  animate: () => ({ stop: vi.fn() }),
}));
