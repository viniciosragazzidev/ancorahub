import { describe, expect, it } from "vitest";
import { generateAiResponse } from "./service";
import { handleInitialMessageFailure, resolveMemoryResetContext } from "./conversation-state-machine";
import { createEmptyMemory, extractFieldsFromMessage, type ConversationMemory } from "./memory";

describe("ai-agent service & state machine", () => {
  describe("resolveMemoryResetContext", () => {
    const history: Array<{ role: "user" | "assistant"; content: string }> = [
      { role: "assistant", content: "Qual é o seu nome?" },
      { role: "user", content: "Meu nome é Maria" },
    ];
    const storedMemory: ConversationMemory = {
      ...createEmptyMemory(),
      customerName: { value: "Maria", confidence: 1 },
      customerFirstName: { value: "Maria", confidence: 1 },
      collectedFields: ["customerName"],
    };

    it("resets memory and sends only the current message when mode is before_each_message", () => {
      const result = resolveMemoryResetContext({
        resetMode: "before_each_message",
        storedMemory,
        formattedHistory: history,
        currentMessage: "Quero uma cotação",
        historyAlreadyContainsCurrentMessage: false,
      });

      expect(result.resetMemoryEachMessage).toBe(true);
      // Memória base zerada, ignorando o que estava armazenado
      expect(result.baseMemory.collectedFields).toEqual([]);
      expect(result.baseMemory.customerName).toBeUndefined();
      // Contexto da IA contém apenas a mensagem atual
      expect(result.aiMessages).toEqual([{ role: "user", content: "Quero uma cotação" }]);
    });

    it("preserves stored memory and full history on before_each_session", () => {
      const result = resolveMemoryResetContext({
        resetMode: "before_each_session",
        storedMemory,
        formattedHistory: history,
        currentMessage: "Quero uma cotação",
        historyAlreadyContainsCurrentMessage: false,
      });

      expect(result.resetMemoryEachMessage).toBe(false);
      expect(result.baseMemory.customerName?.value).toBe("Maria");
      expect(result.aiMessages).toEqual([...history, { role: "user", content: "Quero uma cotação" }]);
    });

    it("does not duplicate the current message when history already contains it", () => {
      const result = resolveMemoryResetContext({
        resetMode: "before_each_session",
        storedMemory,
        formattedHistory: history,
        currentMessage: "Meu nome é Maria",
        historyAlreadyContainsCurrentMessage: true,
      });

      expect(result.aiMessages).toEqual(history);
    });

    it("defaults to before_each_session when no mode is configured", () => {
      const result = resolveMemoryResetContext({
        resetMode: undefined,
        storedMemory,
        formattedHistory: history,
        currentMessage: "Olá",
        historyAlreadyContainsCurrentMessage: false,
      });

      expect(result.resetMemoryEachMessage).toBe(false);
      expect(result.baseMemory.customerName?.value).toBe("Maria");
    });

    it("treats never and manual like session mode (keeps context)", () => {
      for (const mode of ["never", "manual"]) {
        const result = resolveMemoryResetContext({
          resetMode: mode,
          storedMemory,
          formattedHistory: history,
          currentMessage: "Olá",
          historyAlreadyContainsCurrentMessage: false,
        });
        expect(result.resetMemoryEachMessage).toBe(false);
        expect(result.baseMemory.customerName?.value).toBe("Maria");
      }
    });

    it("extracts only fields from the current message when resetting each message", () => {
      const result = resolveMemoryResetContext({
        resetMode: "before_each_message",
        storedMemory,
        formattedHistory: history,
        currentMessage: "Meu nome é João Silva e tenho 34 anos",
        historyAlreadyContainsCurrentMessage: false,
      });

      const updatedMemory = extractFieldsFromMessage("Meu nome é João Silva e tenho 34 anos", result.baseMemory);
      expect(updatedMemory.customerName?.value).toBe("João Silva");
      expect(updatedMemory.age?.value).toBe("34");
      // Campos antigos da memória armazenada não vazam para o novo contexto
      expect(updatedMemory.customerName?.value).not.toContain("Maria");
      // A memória persistida no turno contém apenas os campos extraídos agora
      expect(updatedMemory.collectedFields).toEqual(["customerName", "age"]);
    });
  });
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

  it("handles initial message failure gracefully by closing conversation and queueing lead for distribution", async () => {
    await expect(
      handleInitialMessageFailure({
        tenantId: "tenant-test-123",
        leadId: "lead-test-123",
        conversationId: "conv-test-123",
        reason: "initial_message_dispatch_failed",
      })
    ).resolves.not.toThrow();
  });
});
