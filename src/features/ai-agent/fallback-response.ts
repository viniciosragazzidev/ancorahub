import type { AiStructuredResponse } from "./ai-response-schema";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Deterministic recovery that always advances to the next missing field. */
export function createSafeFallbackResponse(
  customerName?: string | null,
  memoryContext?: string,
): AiStructuredResponse {
  const lines = memoryContext?.split("\n") ?? [];
  const markerIndex = lines.findIndex((line) => {
    const value = normalize(line);
    return value.includes("dados ainda necessarios") || value.includes("informacoes ainda nao coletadas");
  });
  const pending = markerIndex >= 0
    ? lines.slice(markerIndex + 1).find((line) => line.trim().startsWith("-"))
    : undefined;
  const label = normalize(pending?.replace(/^\s*-\s*/, "").trim() ?? "");
  const isPme = lines.some((line) => normalize(line).includes("tipo de plano: empresarial"));
  const next = label.includes("nome")
    ? { field: "customerName", message: "Como você prefere ser chamado(a)?" }
    : label.includes("cidade")
      ? { field: "city", message: "Em qual cidade você mora?" }
      : label.includes("tipo de plano")
        ? { field: "planType", message: "O plano seria individual, familiar ou empresarial?" }
        : label.includes("vidas") || label.includes("pessoas")
          ? { field: "numberOfLives", message: "Quantas pessoas serão incluídas no plano?" }
          : label.includes("idade")
            ? isPme
              ? { field: "age", message: "Para dimensionar as opções para a empresa, qual é a média aproximada de idade do grupo?" }
              : { field: "age", message: "Quais são as idades das pessoas que serão incluídas?" }
            : label.includes("e-mail") || label.includes("email")
              ? { field: "email", message: "Qual e-mail podemos usar para continuar o atendimento?" }
              : undefined;
  const firstName = customerName?.split(/\s+/)[0];
  const prefix = firstName ? `Perfeito, ${firstName}. ` : "Perfeito. ";
  const message = next
    ? `${prefix}${next.message}`
    : customerName
      ? `${customerName}, recebi sua mensagem. Qual é o próximo detalhe que você gostaria de informar?`
      : "Recebi sua mensagem. Qual detalhe você gostaria de informar primeiro?";

  return {
    message,
    language: "pt-BR",
    detectedIntent: "collecting_info",
    shouldTransfer: false,
    shouldWait: true,
    questionAsked: next ? { field: next.field, text: next.message } : undefined,
    confidence: 0.5,
  };
}
