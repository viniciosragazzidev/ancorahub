import { POST_SALE_META_TEMPLATE } from "@/features/post-sale-audit/template-contract";

export const POST_SALE_PROVIDER_STATUS_PRIORITY = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4,
} as const;

export type PostSaleProviderStatus = keyof typeof POST_SALE_PROVIDER_STATUS_PRIORITY;

export function shouldRecoverInitialQualificationAfterOutboundFailure(purpose: string | null | undefined) {
  return purpose !== "postSaleSurvey";
}

export function resolvePostSaleConversationBody(input: {
  renderedBody: string | null;
  templateName: string | null;
  variables: unknown;
}): string | null {
  const renderedBody = input.renderedBody?.trim();
  if (renderedBody) return renderedBody;
  if (input.templateName !== POST_SALE_META_TEMPLATE.name || !Array.isArray(input.variables)) return null;

  const values = [input.variables[0], input.variables[1], input.variables[2]];
  if (values.some((value) => typeof value !== "string" || !value.trim())) return null;

  return POST_SALE_META_TEMPLATE.body.replace(/\{\{([1-3])\}\}/g, (_match, index: string) =>
    (values[Number(index) - 1] as string).trim(),
  );
}

export function preferPostSaleProviderStatus(
  current: string | null | undefined,
  incoming: string,
): string {
  const currentPriority = current && current in POST_SALE_PROVIDER_STATUS_PRIORITY
    ? POST_SALE_PROVIDER_STATUS_PRIORITY[current as PostSaleProviderStatus]
    : 0;
  const incomingPriority = incoming in POST_SALE_PROVIDER_STATUS_PRIORITY
    ? POST_SALE_PROVIDER_STATUS_PRIORITY[incoming as PostSaleProviderStatus]
    : 0;

  return currentPriority >= incomingPriority ? current ?? incoming : incoming;
}
