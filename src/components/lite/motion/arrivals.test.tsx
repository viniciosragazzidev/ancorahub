// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { arrivedKeys, useArrivedKeys } from "./arrivals";

describe("arrivals", () => {
  it("lists only keys that were not there at first", () => {
    expect([...arrivedKeys(new Set(["a", "b"]), ["a", "c", "b", "d"])]).toEqual(["c", "d"]);
  });

  it("keeps the first render as the baseline", () => {
    const { result, rerender } = renderHook(({ keys }) => useArrivedKeys(keys), { initialProps: { keys: ["a"] } });
    expect(result.current.size).toBe(0);
    rerender({ keys: ["b", "a"] });
    expect([...result.current]).toEqual(["b"]);
  });
});
