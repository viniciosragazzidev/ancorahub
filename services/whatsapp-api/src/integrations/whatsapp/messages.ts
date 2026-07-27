import type { SendTestMessageInput } from "./types.js";

const phonePattern = /^\d{8,15}$/;

export function normalizeTestMessage(input: SendTestMessageInput): SendTestMessageInput {
  const to = input.to.replace(/\D/g, "");
  const message = input.message.trim();

  if (!phonePattern.test(to)) throw new Error("O destinatário deve ser um telefone internacional válido.");
  if (!message) throw new Error("A mensagem é obrigatória.");
  if (message.length > 4096) throw new Error("A mensagem deve ter no máximo 4.096 caracteres.");

  return { to, message };
}

export function buildMetaTextPayload(input: SendTestMessageInput) {
  return {
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to: input.to,
    type: "text" as const,
    text: { preview_url: false, body: input.message },
  };
}
