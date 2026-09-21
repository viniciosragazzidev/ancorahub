import { describe, expect, it } from "vitest";

import { derivePairingPhase } from "./pairing-phase";

describe("derivePairingPhase", () => {
  it("shows the QR only when the provider is waiting for a scan and a QR exists", () => {
    expect(derivePairingPhase({ status: "initializing", providerStatus: "SCAN_QR_CODE", hasQr: true, sawQr: true })).toBe("qr");
  });

  it("keeps generating while SCAN_QR_CODE has no QR yet, even after a previous QR", () => {
    // QR em rotação: nunca reexibir imagem antiga nem confundir com pareamento.
    expect(derivePairingPhase({ status: "initializing", providerStatus: "SCAN_QR_CODE", hasQr: false, sawQr: true })).toBe("starting");
  });

  it("treats leaving SCAN_QR_CODE after a shown QR as the device pairing", () => {
    expect(derivePairingPhase({ status: "initializing", providerStatus: "STARTING", hasQr: false, sawQr: true })).toBe("pairing");
  });

  it("treats STARTING without any QR shown as still starting", () => {
    expect(derivePairingPhase({ status: "initializing", providerStatus: "STARTING", hasQr: false, sawQr: false })).toBe("starting");
  });

  it("maps terminal and idle states", () => {
    expect(derivePairingPhase({ status: "ready", providerStatus: "WORKING", hasQr: false, sawQr: true })).toBe("ready");
    expect(derivePairingPhase({ status: "error", providerStatus: "FAILED", hasQr: false, sawQr: true })).toBe("error");
    expect(derivePairingPhase({ status: "disconnected", providerStatus: "STOPPED", hasQr: false, sawQr: false })).toBe("idle");
    expect(derivePairingPhase({ status: "recovering", hasQr: false, sawQr: false })).toBe("starting");
  });

  it("works without a provider status (older Fastify deploy)", () => {
    expect(derivePairingPhase({ status: "initializing", hasQr: true, sawQr: false })).toBe("qr");
    expect(derivePairingPhase({ status: "initializing", hasQr: false, sawQr: true })).toBe("pairing");
  });
});
