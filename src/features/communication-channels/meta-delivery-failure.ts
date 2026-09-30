export type DirectorFacingMetaDeliveryFailure = {
  code: string;
  title: string;
  message: string;
};

const knownFailures: Record<string, Omit<DirectorFacingMetaDeliveryFailure, "code">> = {
  "131042": {
    title: "Cobrança da conta WhatsApp pendente",
    message:
      "A Meta bloqueou a entrega porque a conta WhatsApp Business está com uma pendência de cobrança ou elegibilidade. Revise o método de pagamento vinculado à WABA no Meta Business Suite.",
  },
  "131026": {
    title: "Mensagem não pôde ser entregue",
    message:
      "A Meta não conseguiu entregar a mensagem para este número. Confirme se o destinatário usa WhatsApp e tente novamente.",
  },
  "131049": {
    title: "Meta limitou mensagens para este contato",
    message:
      "A Meta não entregou para manter o engajamento saudável: este contato recebeu muitas mensagens de empresas recentemente. Tente mais tarde ou fale por outro canal.",
  },
  "131047": {
    title: "Janela de conversa indisponível",
    message:
      "A Meta bloqueou esta mensagem fora da janela de atendimento. Use um modelo aprovado para retomar o contato.",
  },
};

/**
 * Converts only the provider's stable error code into a Director-facing
 * explanation. Raw provider payloads can contain sensitive operational data
 * and must not be sent to the browser.
 */
export function getDirectorFacingMetaDeliveryFailure(
  rawCode: string | null | undefined,
): DirectorFacingMetaDeliveryFailure | null {
  const code = rawCode?.trim();
  if (!code) return null;

  const known = knownFailures[code];
  if (known) return { code, ...known };

  return {
    code,
    title: "Entrega recusada pela Meta",
    message:
      "A Meta recusou a entrega. Consulte o código informado e a configuração do canal WhatsApp antes de tentar novamente.",
  };
}

/** The lead note: what happened, why (Meta's reason when known) and what the team does next. */
export function initialMessageFailureNote(failureCode?: string | null) {
  const failure = getDirectorFacingMetaDeliveryFailure(failureCode);
  const why = failure ? ` Motivo (${failure.code}): ${failure.title}. ${failure.message}` : "";
  return `⚠️ A primeira mensagem do atendimento virtual não chegou ao WhatsApp do lead.${why} A IA foi encerrada e o lead foi enviado para a distribuição como "Sem contato no WhatsApp" para um corretor entrar em contato.`;
}

/** Chat to a broker set to the company WhatsApp while it is down, outside the broker's Meta window. */
export function companyChatUnavailableMessage(pausedUntil: Date | null) {
  const state = pausedUntil
    ? `está pausado até ${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(pausedUntil)} por falhas seguidas`
    : "está desconectado";
  return `O WhatsApp da empresa ${state}. A mensagem não foi enviada: pela Meta, o corretor só recebe texto livre se tiver falado com o número oficial nas últimas 24h.`;
}
