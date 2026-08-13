type ProviderError = {
  code?: unknown;
};

/**
 * Cloud API expects an international number without punctuation. The operational
 * screen is Brazil-first, so local 10/11-digit Brazilian numbers receive +55.
 */
export function normalizeWhatsAppDestination(value: string): string {
  const digits = value.replace(/\D/g, "");

  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

function getProviderErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;

  const code = (error as ProviderError).code;
  return typeof code === "number" ? code : null;
}

/** Keeps provider details out of the client while explaining the next safe action. */
export function getWhatsAppTestFailureMessage(error: unknown): string {
  switch (getProviderErrorCode(error)) {
    case 133010:
      return "A Meta não encontrou uma conta WhatsApp registrada para este envio. Confirme se o número de destino está ativo no WhatsApp e se o número oficial recém-conectado já está registrado e ativo na Cloud API.";
    case 131047:
      return "A conversa está fora da janela de 24 horas. Para testar sem uma mensagem recente do contato, envie um template oficial aprovado.";
    case 131026:
      return "A Meta não conseguiu entregar a mensagem a esse número. Confirme se o WhatsApp do contato está ativo e se ele pode receber mensagens.";
    default:
      return "A Meta não enviou a mensagem de teste. Confira o número, o tipo de mensagem e o status do canal antes de tentar novamente.";
  }
}
