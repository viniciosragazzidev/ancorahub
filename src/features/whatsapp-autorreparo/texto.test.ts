import { describe, expect, it } from "vitest";
import { MENSAGEM_AVISO_RECONEXAO, TITULO_AVISO_RECONEXAO } from "./texto";

describe("texto do aviso de reconexão", () => {
  it("usa a mensagem aprovada pelo Vinicios, sem travessão", () => {
    expect(MENSAGEM_AVISO_RECONEXAO).toBe(
      "Você está de plantão amanhã e seu WhatsApp não está conectado. Reconecte hoje para que suas conversas com os clientes fiquem registradas no CRM.",
    );
    expect(MENSAGEM_AVISO_RECONEXAO).not.toContain("—");
    expect(TITULO_AVISO_RECONEXAO).toBe("Reconecte seu WhatsApp");
  });
});
