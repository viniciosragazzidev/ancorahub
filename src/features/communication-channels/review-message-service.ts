import "server-only";

import { z } from "zod";

const reviewInputSchema = z.object({
  to: z.string().trim().min(8).max(24),
  message: z.string().trim().min(1).max(4096),
});

type ReviewServiceConfiguration = {
  configured: boolean;
  missing: string[];
};

function getReviewServiceEnvironment() {
  const url = process.env.WHATSAPP_REVIEW_API_URL?.trim().replace(/\/$/, "") || "";
  const internalToken = process.env.WHATSAPP_REVIEW_INTERNAL_TOKEN?.trim() || "";
  const missing = [
    ...(!url ? ["WHATSAPP_REVIEW_API_URL"] : []),
    ...(!internalToken ? ["WHATSAPP_REVIEW_INTERNAL_TOKEN"] : []),
  ];
  return { url, internalToken, missing };
}

export function getWhatsAppReviewServiceConfiguration(): ReviewServiceConfiguration {
  const { missing } = getReviewServiceEnvironment();
  return { configured: missing.length === 0, missing };
}

export async function sendWhatsAppReviewMessage(rawInput: unknown): Promise<{ messageId: string }> {
  const input = reviewInputSchema.parse(rawInput);
  const environment = getReviewServiceEnvironment();
  if (environment.missing.length) throw new Error("O serviço independente de revisão do WhatsApp não está configurado.");

  const response = await fetch(`${environment.url}/api/integrations/whatsapp/send-test-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CorreTop-Internal-Token": environment.internalToken,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { success?: boolean; data?: { messageId?: string } } | null;
  if (!response.ok || !payload?.success || !payload.data?.messageId) {
    throw new Error("Não foi possível enviar a mensagem de revisão. Verifique a configuração do serviço e da Meta.");
  }
  return { messageId: payload.data.messageId };
}
