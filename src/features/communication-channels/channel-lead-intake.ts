/**
 * Lead intake of an official number dedicated to ads (e.g. the WhatsApp
 * number of the CA1 click-to-WhatsApp ads): a new contact that writes to it
 * becomes a lead with this origin, in this queue, even without the ad's
 * referral (Meta only sends it on the first message after the click). Pure.
 */
export type ChannelLeadIntake = {
  enabled: boolean;
  /** Queue the lead goes to; null = the tenant's regular routing. */
  queueId: string | null;
  /** Origin shown on the lead, e.g. "Anúncios CA1 - Ancora Corretora". */
  label: string | null;
  /**
   * Whether the AI qualifies the leads of this number. Off by default: such a
   * number usually has its own automation in the WhatsApp Business app, so
   * the lead is only received and distributed.
   */
  aiQualification: boolean;
};

export const CHANNEL_LEAD_INTAKE_OFF: ChannelLeadIntake = { enabled: false, queueId: null, label: null, aiQualification: false };

export function channelLeadIntakeKey(channelId: string) {
  return `channel_lead_intake_${channelId}`;
}

export function parseChannelLeadIntake(raw: string | null | undefined): ChannelLeadIntake {
  if (!raw) return CHANNEL_LEAD_INTAKE_OFF;
  try {
    const value = JSON.parse(raw) as Partial<ChannelLeadIntake>;
    return {
      enabled: value.enabled === true,
      queueId: typeof value.queueId === "string" && value.queueId ? value.queueId : null,
      label: typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 80) : null,
      aiQualification: value.aiQualification === true,
    };
  } catch {
    return CHANNEL_LEAD_INTAKE_OFF;
  }
}
