/** Texts of the "follow-up de quem parou de responder" setting, shared by the classic and Lite screens. */
export const SILENCE_FOLLOW_UP_DESCRIPTION =
  "Se o cliente para de responder no meio da qualificação, a IA manda uma mensagem curta retomando a última pergunta, uma vez, na metade do tempo limite e só entre 8h e 21h.";

export const SILENCE_FOLLOW_UP_CHANNEL_OPTIONS = [
  { value: "same", label: "Mesmo canal da conversa (recomendado)" },
  { value: "meta", label: "Só Meta (número oficial)" },
  { value: "waha", label: "Só WAHA" },
];
