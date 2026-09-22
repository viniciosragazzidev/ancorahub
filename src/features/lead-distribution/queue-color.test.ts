import { describe, expect, it } from "vitest";

import { circularHueDistance, pickDistinctHue, QUEUE_COLOR_SWATCHES, queueHueToDotColor } from "./queue-color";

describe("circularHueDistance", () => {
  it("wraps around the 360° boundary", () => {
    expect(circularHueDistance(10, 350)).toBe(20);
    expect(circularHueDistance(0, 180)).toBe(180);
    expect(circularHueDistance(90, 90)).toBe(0);
  });
});

describe("pickDistinctHue", () => {
  it("starts from a fixed swatch when nothing is used yet", () => {
    expect(pickDistinctHue([])).toBe(QUEUE_COLOR_SWATCHES[0]);
  });

  it("picks the hue farthest from every hue already in use", () => {
    // Two queues at 0° and 120° leave the biggest gap around 240°.
    const hue = pickDistinctHue([0, 120]);
    expect(circularHueDistance(hue, 240)).toBeLessThanOrEqual(2);
  });

  it("ignores null/undefined entries from queues without a color yet", () => {
    expect(pickDistinctHue([0, null, undefined, 120])).toBe(pickDistinctHue([0, 120]));
  });

  it("never returns a hue already in use once at least one free slot remains", () => {
    const used = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300];
    const hue = pickDistinctHue(used);
    expect(used).not.toContain(hue);
  });

  it("stays within the least-crowded region even with jitter, across repeats", () => {
    // Three queues already 120° apart tile the circle in thirds — the
    // farthest any new hue can get from all three at once is 60° (the
    // midpoint of a gap), at 60/180/300.
    for (let i = 0; i < 30; i++) {
      const hue = pickDistinctHue([0, 120, 240], { jitter: true });
      const minDistance = Math.min(...[0, 120, 240].map((used) => circularHueDistance(hue, used)));
      expect(minDistance).toBe(60);
      expect([60, 180, 300]).toContain(hue);
    }
  });

  it("random pick without any used hue still returns a valid hue", () => {
    const hue = pickDistinctHue([], { jitter: true });
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(360);
  });
});

describe("queueHueToDotColor", () => {
  it("renders a valid hsl() for a real hue", () => {
    expect(queueHueToDotColor(217)).toBe("hsl(217 72% 50%)");
  });

  it("normalizes out-of-range and fractional hues", () => {
    expect(queueHueToDotColor(-10)).toBe("hsl(350 72% 50%)");
    expect(queueHueToDotColor(370)).toBe("hsl(10 72% 50%)");
    expect(queueHueToDotColor(120.6)).toBe("hsl(121 72% 50%)");
  });

  it("falls back to neutral gray for a queue without a color yet", () => {
    expect(queueHueToDotColor(null)).toBe("hsl(0 0% 65%)");
    expect(queueHueToDotColor(undefined)).toBe("hsl(0 0% 65%)");
  });
});
