import {
  buildEventVariableValues,
  getMessageEventByKey,
  renderEventFreeMessage,
  resolveEventVariableKey,
  type MessageEventDefinition,
} from "@/features/communication-channels/message-event-catalog";

/**
 * Broker notices that may leave through the company number (WhatsApp da
 * diretoria) instead of Meta. Left out on purpose: the lead offer (acceptance
 * depends on the Meta template button), the duty presence confirmation
 * (template-only, tokenised link) and the first-access invite (secret link).
 */
export const TENANT_CHANNEL_ROUTABLE_EVENTS = [
  "LEAD_ASSIGNMENT",
  "LEAD_ASSIGNMENT_CONFIRMED",
  "LEAD_ASSIGNMENT_UNAVAILABLE",
  "LEAD_ASSIGNMENT_EXPIRED",
  "LEAD_FEEDBACK_REMINDER",
  "TASK_REMINDER",
  "BROKER_ACCOUNT_ACTIVATED",
] as const;

export type TenantChannelRoutableEvent = (typeof TENANT_CHANNEL_ROUTABLE_EVENTS)[number];

/** event key → free message template id sent through the company number. */
export type TenantChannelRouting = { events: Partial<Record<TenantChannelRoutableEvent, string>> };

export const EMPTY_TENANT_CHANNEL_ROUTING: TenantChannelRouting = { events: {} };

export function isTenantChannelRoutableEvent(key: string): key is TenantChannelRoutableEvent {
  return (TENANT_CHANNEL_ROUTABLE_EVENTS as readonly string[]).includes(key);
}

export function normalizeTenantChannelRouting(value: unknown): TenantChannelRouting {
  const raw = value && typeof value === "object" ? (value as { events?: unknown }).events : null;
  if (!raw || typeof raw !== "object") return EMPTY_TENANT_CHANNEL_ROUTING;
  const events: TenantChannelRouting["events"] = {};
  for (const [key, messageId] of Object.entries(raw as Record<string, unknown>)) {
    if (isTenantChannelRoutableEvent(key) && typeof messageId === "string" && messageId.trim()) events[key] = messageId.trim();
  }
  return { events };
}

/**
 * The free message as the broker reads it. On broker-only events a bare
 * {{nome}} means the broker (the catalog only aliases it to the lead).
 */
export function renderTenantChannelMessage(event: MessageEventDefinition, content: string, rawVariables: readonly string[]) {
  const values = buildEventVariableValues(event, rawVariables);
  const brokerName = values.corretor_nome ?? values.nome ?? "";
  const withBrokerName = resolveEventVariableKey(event, "nome")
    ? content
    : content.replace(/\{\{\s*nome\s*\}\}/g, brokerName);
  return renderEventFreeMessage(event, withBrokerName, rawVariables).trim();
}

export function tenantChannelEventFor(eventKey: string) {
  return isTenantChannelRoutableEvent(eventKey) ? getMessageEventByKey(eventKey) : null;
}
