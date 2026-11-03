import { describe, expect, it } from "vitest";

import { logoPublicPath, logoStorageKey, parseLogoDataUrl, parseLogoPublicPath } from "./logo-file";

const PNG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("logo da empresa no R2 (egress, 03/11)", () => {
  it("names the file by the content hash, so a new logo gets a new address", () => {
    const parsed = parseLogoDataUrl(PNG_1PX)!;
    expect(parsed.extension).toBe("png");
    expect(parsed.hash).toMatch(/^[a-f0-9]{16}$/);
    const path = logoPublicPath("tenant-1", `${parsed.hash}.png`);
    expect(path).toBe(`/api/tenants/tenant-1/logo/${parsed.hash}.png`);
    expect(logoStorageKey("tenant-1", `${parsed.hash}.png`)).toBe(`logos/tenants/tenant-1/${parsed.hash}.png`);
    // The column keeps a few dozen characters instead of the whole image.
    expect(path.length).toBeLessThan(80);
  });

  it("recognizes only a stored logo path", () => {
    expect(parseLogoPublicPath("/api/tenants/tenant-1/logo/0123456789abcdef.png")).toEqual({ tenantId: "tenant-1", fileName: "0123456789abcdef.png" });
    expect(parseLogoPublicPath(PNG_1PX)).toBeNull();
    expect(parseLogoPublicPath("https://cdn.example.com/logo.png")).toBeNull();
    expect(parseLogoPublicPath("/api/tenants/tenant-1/logo/../secret.png")).toBeNull();
    expect(parseLogoPublicPath("/api/users/u1/avatar/0123456789abcdef.png")).toBeNull();
    expect(parseLogoPublicPath(null)).toBeNull();
  });
});
