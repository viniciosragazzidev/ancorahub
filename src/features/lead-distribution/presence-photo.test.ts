import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cleanPresencePhoto, isAllowedImage } from "./presence-photo";

describe("presence photo", () => {
  it("accepts only real JPEG, PNG or WebP bytes", () => {
    expect(isAllowedImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isAllowedImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe(true);
    expect(isAllowedImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe(true);
    expect(isAllowedImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBe(false);
    expect(isAllowedImage(new TextEncoder().encode("<html>"))).toBe(false);
  });

  it("re-encodes to JPEG without any metadata (no GPS) and limits the size", async () => {
    const withGps = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#3366cc" } })
      .withExif({ IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "22/1 45/1 0/1" } })
      .png()
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeTruthy();
    const clean = await cleanPresencePhoto(withGps);
    const meta = await sharp(clean).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
  });
});
