/**
 * Campanhas de pós-venda (26/11, Campanhas do DeskComm): "Enviar teste para mim" antes do disparo e "Duplicar" um
 * envio do histórico. Funções puras: a montagem do teste, o limite por hora e o rascunho da cópia.
 */
import { POST_SALE_META_TEMPLATE, POST_SALE_WAHA_OPENING_DEFAULT } from "./template-contract";
import { firstName, renderPostSaleOpeningMessage, type PostSaleAudience } from "./rules";

export const POST_SALE_TEST_HOURLY_LIMIT = 3;
export const POST_SALE_TEST_WINDOW_MS = 60 * 60 * 1000;
export const POST_SALE_TEST_KEY_PREFIX = "post-sale-test:";

export function postSaleTestIdempotencyKey(userId: string, now: Date) {
  return `${POST_SALE_TEST_KEY_PREFIX}${userId}:${now.getTime()}`;
}

/** Quantos testes ainda cabem na última hora e, sem nenhum, quando abre a próxima vaga. */
export function postSaleTestQuota(sentAt: readonly Date[], now: Date, limit = POST_SALE_TEST_HOURLY_LIMIT) {
  const windowStart = now.getTime() - POST_SALE_TEST_WINDOW_MS;
  const recent = sentAt.map((date) => date.getTime()).filter((time) => time > windowStart && time <= now.getTime()).sort((a, b) => a - b);
  const remaining = Math.max(0, limit - recent.length);
  const retryAt = remaining > 0 ? null : new Date(recent[recent.length - limit]! + POST_SALE_TEST_WINDOW_MS);
  return { remaining, retryAt };
}

export type PostSaleTestMessage =
  | { channelType: "waha"; body: string }
  | { channelType: "meta"; variables: [string, string, string]; body: string };

/**
 * A mensagem do teste é a mesma que o cliente de exemplo receberia: no WAHA, o texto inicial com as variáveis trocadas;
 * na Meta, o template aprovado com as mesmas 3 variáveis do disparo.
 */
export function buildPostSaleTestMessage(input: {
  channelType: "waha" | "meta";
  openingMessage: string;
  exampleName: string | null | undefined;
  companyName: string | null | undefined;
  assistantName: string | null | undefined;
  brokerName: string | null | undefined;
}): PostSaleTestMessage {
  const nome = firstName(input.exampleName);
  const empresa = input.companyName?.trim() || "nossa equipe";
  const assistente = input.assistantName?.trim() || "equipe de qualidade";
  const corretor = input.brokerName?.trim() ? firstName(input.brokerName) : "nosso corretor";
  if (input.channelType === "meta") {
    const variables: [string, string, string] = [nome, empresa, corretor];
    const body = POST_SALE_META_TEMPLATE.body.replace(/\{\{(\d)\}\}/g, (_match, index: string) => variables[Number(index) - 1] ?? "");
    return { channelType: "meta", variables, body };
  }
  const body = renderPostSaleOpeningMessage(input.openingMessage.trim() || POST_SALE_WAHA_OPENING_DEFAULT, { nome, assistente, empresa, corretor });
  return { channelType: "waha", body };
}

export const POST_SALE_CAMPAIGN_NAME_MAX = 120;
const COPY_SUFFIX = " (cópia)";

/** Rascunho igual ao envio do histórico: mesmo público e texto, nome com "(cópia)". */
export function duplicatePostSaleCampaignDraft(source: { name: string; audience: PostSaleAudience; openingMessage: string | null }) {
  const base = source.name.trim().replace(/ \(cópia\)$/, "") || "Pós-venda";
  return {
    name: `${base.slice(0, POST_SALE_CAMPAIGN_NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
    audience: source.audience,
    openingMessage: source.openingMessage?.trim() || POST_SALE_WAHA_OPENING_DEFAULT,
  };
}

/** Como o formulário de "Nova campanha" mostra um público salvo. */
export type PostSaleCampaignForm =
  | { kind: "broker"; brokerId: string; from: string; to: string }
  | { kind: "queue"; queueId: string; from: string; to: string }
  | { kind: "period"; from: string; to: string }
  | { kind: "leadIds"; leadIds: string[] };

export function postSaleAudienceToForm(audience: PostSaleAudience): PostSaleCampaignForm {
  if (audience.kind === "lead") return { kind: "leadIds", leadIds: [audience.leadId] };
  if (audience.kind === "leadIds") return { kind: "leadIds", leadIds: audience.leadIds };
  const from = audience.arrivalFrom ?? "";
  const to = audience.arrivalTo ?? "";
  if (audience.kind === "broker") return { kind: "broker", brokerId: audience.brokerId, from, to };
  if (audience.queueId) return { kind: "queue", queueId: audience.queueId, from, to };
  return { kind: "period", from, to };
}
