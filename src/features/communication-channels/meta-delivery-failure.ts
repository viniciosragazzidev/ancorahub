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
