export type DutyScheduleCredential = {
  id: string;
  webhookCredentialId: string | null;
};

/**
 * A plantão without a credential is the catch-all schedule for every origin.
 * A credential-specific plantão only accepts leads from that credential.
 */
export function selectMatchingDutyScheduleIds(
  schedules: DutyScheduleCredential[],
  leadWebhookCredentialId?: string | null,
) {
  return schedules
    .filter((schedule) =>
      schedule.webhookCredentialId === null
        ? true
        : Boolean(leadWebhookCredentialId && schedule.webhookCredentialId === leadWebhookCredentialId),
    )
    .map((schedule) => schedule.id);
}
