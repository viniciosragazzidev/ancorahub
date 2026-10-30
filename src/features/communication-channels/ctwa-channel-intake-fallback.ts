/**
 * Whether an ad click (CTWA) that the campaign policy would ignore becomes a lead in the number's own
 * queue instead (30/10). The number's intake sheet promises it: "quem vem de uma campanha sem regra de
 * fila" also becomes a lead. Only when the tenant capture is on, the number's intake is on, and the
 * campaign has no usable rule: none (not synced, no ad account default) or one whose queue is not
 * active. A rule turned off on purpose still ignores. Pure.
 */
export function shouldUseChannelIntakeForCtwa(input: {
  decisionAction: "capture" | "ignore";
  globalMode: string;
  /** The campaign route from the resolver (own rule or the ad account default), if any. */
  campaignRoute: { enabled: boolean; queueStatus?: string | null } | undefined | null;
  channelIntakeEnabled: boolean;
}): boolean {
  if (input.decisionAction !== "ignore" || input.globalMode === "disabled" || !input.channelIntakeEnabled) return false;
  if (!input.campaignRoute) return true;
  if (!input.campaignRoute.enabled) return false;
  return input.campaignRoute.queueStatus !== "active";
}
