/**
 * Whether an ad click (CTWA) that the campaign policy would ignore becomes a lead in the number's own
 * queue instead. Only when the tenant capture is on, the campaign has no rule (or was not identified)
 * and the number's lead intake is on. Pure.
 */
export function shouldUseChannelIntakeForCtwa(input: {
  decisionAction: "capture" | "ignore";
  globalMode: string;
  hasCampaignRule: boolean;
  channelIntakeEnabled: boolean;
}): boolean {
  return input.decisionAction === "ignore"
    && input.globalMode !== "disabled"
    && !input.hasCampaignRule
    && input.channelIntakeEnabled;
}
