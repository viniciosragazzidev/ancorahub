// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { onWhatsAppOpenFailed, rememberWhatsAppHandoff, reportWhatsAppOpenFailed, takeWhatsAppHandoff } from "./handoff-store";

afterEach(() => window.sessionStorage.clear());

describe("handoff-store", () => {
  it("guarda a fase: contador por padrão (computador)", () => {
    rememberWhatsAppHandoff("l1", "https://wa.me/1");
    expect(takeWhatsAppHandoff("l1")).toEqual({ url: "https://wa.me/1", phase: "counting" });
    expect(takeWhatsAppHandoff("l1")).toBeNull();
  });

  it("celular sem abrir: avisa a tela do lead já montada e não repete ao recarregar", () => {
    const listener = vi.fn();
    const stop = onWhatsAppOpenFailed("l1", listener);
    reportWhatsAppOpenFailed("l1", "https://wa.me/1");
    expect(listener).toHaveBeenCalledWith("https://wa.me/1");
    expect(takeWhatsAppHandoff("l1")).toBeNull();
    stop();
  });

  it("celular sem abrir antes de a tela montar: fica guardado como 'failed'", () => {
    reportWhatsAppOpenFailed("l2", "https://wa.me/2");
    expect(takeWhatsAppHandoff("l2")).toEqual({ url: "https://wa.me/2", phase: "failed" });
  });

  it("ignora o aviso de outro lead", () => {
    const listener = vi.fn();
    const stop = onWhatsAppOpenFailed("l1", listener);
    reportWhatsAppOpenFailed("l9", "https://wa.me/9");
    expect(listener).not.toHaveBeenCalled();
    stop();
  });
});
