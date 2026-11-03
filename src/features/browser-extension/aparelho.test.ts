import { describe, expect, it } from "vitest";
import { descreverAparelho } from "./aparelho";

describe("descrição do aparelho", () => {
  it("Chrome no Windows (não confunde com Edge nem Safari)", () => {
    expect(descreverAparelho("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")).toBe("Chrome no Windows");
  });

  it("Edge no Windows", () => {
    expect(descreverAparelho("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36 Edg/124.0")).toBe("Edge no Windows");
  });

  it("Safari no iPhone e Chrome no Android", () => {
    expect(descreverAparelho("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")).toBe("Safari no iOS");
    expect(descreverAparelho("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36")).toBe("Chrome no Android");
  });

  it("cai em um nome genérico quando não reconhece", () => {
    expect(descreverAparelho("curl/8.0")).toBe("Navegador");
  });
});
