const phonePattern = /^\d{8,15}$/;
export function normalizeTestMessage(input) {
    const to = input.to.replace(/\D/g, "");
    const message = input.message.trim();
    if (!phonePattern.test(to))
        throw new Error("O destinatário deve ser um telefone internacional válido.");
    if (!message)
        throw new Error("A mensagem é obrigatória.");
    if (message.length > 4096)
        throw new Error("A mensagem deve ter no máximo 4.096 caracteres.");
    return { to, message };
}
export function buildMetaTextPayload(input) {
    return {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: { preview_url: false, body: input.message },
    };
}
