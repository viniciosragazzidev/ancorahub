import { describe, expect, it } from "vitest";
import { createFailureLimiter, EXTENSION_EXCHANGE_FAILURE_LIMIT, ExtensionRateLimitError, ipDoCliente } from "./rate-limit";

describe("falhas do exchange contam no limite por IP", () => {
  it("bloqueia o IP depois de 10 falhas na janela, mesmo com código válido", () => {
    const limitador = createFailureLimiter(EXTENSION_EXCHANGE_FAILURE_LIMIT);
    for (let i = 0; i < EXTENSION_EXCHANGE_FAILURE_LIMIT.requests; i++) limitador.registrarFalha("203.0.113.7", 0);
    expect(() => limitador.verificar("203.0.113.7", 0)).toThrow(ExtensionRateLimitError);
    // Outro IP continua livre.
    expect(() => limitador.verificar("198.51.100.9", 0)).not.toThrow();
  });

  it("libera o IP quando as falhas saem da janela de 1 minuto", () => {
    const limitador = createFailureLimiter(EXTENSION_EXCHANGE_FAILURE_LIMIT);
    for (let i = 0; i < EXTENSION_EXCHANGE_FAILURE_LIMIT.requests; i++) limitador.registrarFalha("203.0.113.7", 0);
    expect(() => limitador.verificar("203.0.113.7", 59_999)).toThrow(ExtensionRateLimitError);
    expect(() => limitador.verificar("203.0.113.7", 60_000)).not.toThrow();
  });

  it("informa o tempo de espera até a falha mais antiga sair da janela", () => {
    const limitador = createFailureLimiter(EXTENSION_EXCHANGE_FAILURE_LIMIT);
    for (let i = 0; i < EXTENSION_EXCHANGE_FAILURE_LIMIT.requests; i++) limitador.registrarFalha("ip", 10_000 + i);
    try {
      limitador.verificar("ip", 20_000);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ExtensionRateLimitError);
      expect((error as ExtensionRateLimitError).retryAfter).toBe(50);
    }
  });

  it("usa o último IP do X-Forwarded-For (o que o proxy viu), não o primeiro, que pode ser forjado", () => {
    const pedido = (cabecalhos: Record<string, string>) => new Request("https://crm.test/api/extension/auth/exchange", { headers: cabecalhos });
    expect(ipDoCliente(pedido({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(ipDoCliente(pedido({ "x-forwarded-for": "10.0.0.1" }))).toBe("10.0.0.1");
    expect(ipDoCliente(pedido({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(ipDoCliente(pedido({}))).toBe("sem-ip");
  });
});
