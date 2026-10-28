/**
 * A lead distributed before finishing the qualification (time limit: state PARTIAL) whose
 * customer answers later: the AI finishes the defined flow, as long as the broker has not
 * started talking to the customer yet (Vinicios, 28/10: two voices in one chat confuse).
 */
export function canResumeDistributedQualification(input: {
  conversationStatus: string;
  corretorId: string | null;
  qualificationState: string | null;
  leadStatus: string | null;
  brokerMessagesSinceAssignment: number;
}) {
  return input.conversationStatus === "CLOSED"
    && Boolean(input.corretorId)
    && input.qualificationState === "PARTIAL"
    && !["converted", "lost"].includes(input.leadStatus ?? "")
    && input.brokerMessagesSinceAssignment === 0;
}

/** The lead that went to a broker with the qualification unfinished (the official WhatsApp routes it to the AI). */
export function isDistributedPartialQualification(lead: { corretorId: string | null; qualificationState: string | null } | null | undefined) {
  return Boolean(lead?.corretorId) && lead?.qualificationState === "PARTIAL";
}

/** "Lilian Martins 9209" → "Lilian": the first word without the system code. */
export function brokerFirstName(name: string | null | undefined) {
  const word = (name ?? "").split(/\s+/).find((part) => part && !/\d/.test(part));
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : null;
}

/** Final message of a resumed qualification: the customer learns who continues, with no gender guess. */
export function distributedHandoffText(brokerName: string | null | undefined) {
  const first = brokerFirstName(brokerName);
  return first ? `Pronto, já passei suas informações para ${first}, que vai continuar seu atendimento por aqui.` : null;
}
