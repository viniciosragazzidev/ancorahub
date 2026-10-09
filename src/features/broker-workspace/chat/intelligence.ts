/** AI reading of a lead's WhatsApp conversation, saved in leads.qualification_details.aiIntelligence. */
export type LeadIntelligence = {
  summary: string | null;
  nextBestAction: string | null;
  /** Who owes the next message: BROKER, CUSTOMER, INTERNAL or NONE. */
  pendingFrom: string | null;
  sentiment: string | null;
  customerIntent: string | null;
  risk: string | null;
  lastAnalyzedAt: string | null;
};

export function readLeadIntelligence(value: unknown): LeadIntelligence {
  const details = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const assessment = details.aiIntelligence && typeof details.aiIntelligence === "object"
    ? details.aiIntelligence as Record<string, unknown>
    : {};
  const read = (key: string) => typeof assessment[key] === "string" && assessment[key] ? assessment[key] as string : null;
  return {
    summary: read("summary"),
    nextBestAction: read("nextBestAction"),
    pendingFrom: read("pendingFrom"),
    sentiment: read("sentiment"),
    customerIntent: read("customerIntent"),
    risk: read("risk"),
    lastAnalyzedAt: typeof details.aiLastAnalyzedAt === "string" ? details.aiLastAnalyzedAt : null,
  };
}

export function isOutboundMessage(direction: string) {
  return direction === "outgoing" || direction === "outbound";
}
