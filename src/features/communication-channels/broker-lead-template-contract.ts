export const CANONICAL_BROKER_LEAD_TEMPLATE_NAME = "new_lead_broker";

const BROKER_LEAD_EVENT_KEYS = new Set(["LEAD_OFFER", "LEAD_ASSIGNMENT"]);
const BROKER_LEAD_PURPOSES = new Set(["newLeadAssignment", "brokerLeadNotification"]);

export function isBrokerLeadEventKey(eventKey?: string | null) {
  return Boolean(eventKey && BROKER_LEAD_EVENT_KEYS.has(eventKey));
}

export function isBrokerLeadTemplatePurpose(purpose?: string | null) {
  return Boolean(purpose && BROKER_LEAD_PURPOSES.has(purpose));
}

export function isCanonicalBrokerLeadTemplateName(name?: string | null) {
  return name === CANONICAL_BROKER_LEAD_TEMPLATE_NAME;
}
