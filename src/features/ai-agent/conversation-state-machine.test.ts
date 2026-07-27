import { describe, expect, it } from "vitest";
import { generateAiResponse } from "./service";

describe("ai-agent service & state machine", () => {
  it("should generate a fallback response and detect human request when no API key is set", async () => {
    const result = await generateAiResponse({
      tenantId: "tenant-test",
      messages: [{ role: "user", content: "Quero uma cotação para plano de saúde familiar com corretor humano" }],
    });

    expect(result.success).toBe(true);
    expect(result.shouldTransferToHuman).toBe(true);
    expect(result.transferReason).toBe("Solicitou cotação ou atendimento humano");
  });

  it("should generate a normal AI greeting when user asks a basic question", async () => {
    const result = await generateAiResponse({
      tenantId: "tenant-test",
      leadName: "Carlos",
      messages: [{ role: "user", content: "Olá, bom dia" }],
    });

    expect(result.success).toBe(true);
    expect(result.shouldTransferToHuman).toBe(false);
    expect(result.content).toContain("Carlos");
  });

  it("continues the qualification after a short answer instead of restarting the greeting fallback", async () => {
    const result = await generateAiResponse({
      tenantId: "tenant-test",
      leadName: "Vinícius",
      memoryContext: "DADOS JÁ COLETADOS:\n- Cidade: Nova Iguaçu\n- Tipo de plano: individual\n- N° de vidas: 3\nDADOS AINDA NECESSÁRIOS:\n- Idade",
      messages: [
        { role: "assistant", content: "Certo, Vinícius. Quantas vidas seriam para este plano?" },
        { role: "user", content: "3" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.content).toMatch(/idade/i);
    expect(result.content).not.toMatch(/recebi sua mensagem|o que você está procurando/i);
  });
});
