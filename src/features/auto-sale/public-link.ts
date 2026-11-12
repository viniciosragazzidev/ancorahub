/**
 * Link público da cotação (pedido do Vinicios, 12/11): o cliente abre a cotação numa página do sistema,
 * sem login, pelo WhatsApp. Funciona no WAHA (que só manda texto) e evita despejar PDF e imagens no chat.
 * Só o hash do token fica no banco; o link vale até a validade da cotação e pode ser revogado.
 */
import { createHash, randomBytes } from "node:crypto";

import { offerValidUntil } from "./pdf";
import type { OfferSnapshot } from "./contracts";

export const PUBLIC_QUOTE_PATH = "/compartilhado/cotacao";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export function hashPublicToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPublicToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashPublicToken(token) };
}

export function isPublicTokenShape(token: string) {
  return TOKEN_PATTERN.test(token);
}

/** Fim do último dia de validade em São Paulo (23h59 de Brasília). */
export function publicLinkExpiresAt(offer: Pick<OfferSnapshot, "catalogDate" | "plans">) {
  return new Date(`${offerValidUntil(offer as OfferSnapshot)}T23:59:59-03:00`);
}

export function isPublicLinkUsable(input: { expiresAt: Date | null; revokedAt: Date | null; now: Date }) {
  return !input.revokedAt && Boolean(input.expiresAt) && input.expiresAt!.getTime() > input.now.getTime();
}

export function publicQuoteUrl(token: string, baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm.ancorasaude.cloud") {
  return `${baseUrl.replace(/\/+$/, "")}${PUBLIC_QUOTE_PATH}/${token}`;
}

/** Mensagem com o link, sem preço (o preço já foi na mensagem da cotação e está na página). */
export function quoteLinkMessage(url: string) {
  return `Montei uma página com as opções, a rede e o que precisa para contratar. Dá para baixar o PDF por lá: ${url}`;
}
