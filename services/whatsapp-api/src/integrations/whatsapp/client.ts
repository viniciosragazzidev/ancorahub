import type { MetaMessageResponse, WhatsAppReviewConfig } from "./types.js";

export class MetaGraphError extends Error {
  constructor(readonly statusCode: number, message = "A Meta recusou o envio da mensagem.") {
    super(message);
    this.name = "MetaGraphError";
  }
}

export class MetaGraphTimeoutError extends Error {
  constructor() {
    super("A Meta não respondeu dentro do tempo esperado.");
    this.name = "MetaGraphTimeoutError";
  }
}

export async function postMetaMessage(config: WhatsAppReviewConfig, payload: unknown, fetcher: typeof fetch = fetch): Promise<MetaMessageResponse> {
  let response: Response;
  try {
    response = await fetcher(
      `https://graph.facebook.com/${config.graphApiVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.requestTimeoutMs),
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new MetaGraphTimeoutError();
    throw error;
  }
  const body = await response.json().catch(() => ({})) as MetaMessageResponse;
  if (!response.ok) throw new MetaGraphError(response.status, body.error?.message ?? undefined);
  return body;
}
