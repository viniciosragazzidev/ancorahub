import { describe, expect, it } from "vitest";

import {
  wahaActionCodeFromMessage,
  wahaActionErrorMessage,
  type WahaErrorCode,
} from "./waha-error-codes";

describe("wahaActionCodeFromMessage", () => {
  it("preserva códigos WAHA_* do relay/VPS", () => {
    expect(wahaActionCodeFromMessage("WhatsApp (WAHA_UNAVAILABLE)")).toBe("WAHA_UNAVAILABLE");
    expect(wahaActionCodeFromMessage("WhatsApp (WAHA_TIMEOUT) A rota não respondeu.")).toBe(
      "WAHA_TIMEOUT",
    );
    expect(wahaActionCodeFromMessage("WAHA_INTERNAL_ERROR WAHA retornou status 500.")).toBe(
      "WAHA_INTERNAL_ERROR",
    );
  });

  it("classifica falhas de rede embutidas como WAHA_UNREACHABLE", () => {
    expect(
      wahaActionCodeFromMessage(
        "WAHA_UNREACHABLE Não foi possível conectar ao serviço de WhatsApp em https://api.example.com. Detalhes: fetch failed",
      ),
    ).toBe("WAHA_UNREACHABLE");
  });

  it("retorna WAHA_ERROR quando nenhum código conhecido está presente", () => {
    expect(wahaActionCodeFromMessage("Não foi possível conectar ao serviço.")).toBe("WAHA_ERROR");
    expect(wahaActionCodeFromMessage("")).toBe("WAHA_ERROR");
  });
});

describe("wahaActionErrorMessage", () => {
  it("mantém mensagens específicas por código", () => {
    expect(wahaActionErrorMessage("WAHA_TIMEOUT")).toContain("demorou");
    expect(wahaActionErrorMessage("NO_SESSION")).toContain("Nenhuma sessão");
    expect(wahaActionErrorMessage("QR_ERROR")).toContain("QR Code");
  });

  it("orienta o usuário a forçar desconexão quando o servidor está inalcançável", () => {
    const message = wahaActionErrorMessage("WAHA_UNREACHABLE");
    expect(message).toContain("servidor WhatsApp está temporariamente inacessível");
    expect(message).toContain("forçar a desconexão local");
  });

  it("usa a mensagem genérica para códigos desconhecidos ou ausentes", () => {
    const generic = "Não foi possível completar a operação. Tente novamente.";
    expect(wahaActionErrorMessage("WAHA_ERROR")).toBe(generic);
    expect(wahaActionErrorMessage("UNKNOWN_CODE")).toBe(generic);
    expect(wahaActionErrorMessage(null)).toBe(generic);
    expect(wahaActionErrorMessage(undefined)).toBe(generic);
  });

  it("cobre todos os códigos exportados", () => {
    const codes: WahaErrorCode[] = [
      "WAHA_TIMEOUT",
      "WAHA_UNAVAILABLE",
      "WAHA_UNAUTHORIZED",
      "WAHA_INTERNAL_ERROR",
      "WAHA_BAD_RESPONSE",
      "WAHA_UNREACHABLE",
      "WAHA_ERROR",
      "SESSION_EXISTS",
      "QR_ERROR",
      "NO_SESSION",
    ];
    for (const code of codes) {
      expect(wahaActionErrorMessage(code).length).toBeGreaterThan(10);
    }
  });
});
