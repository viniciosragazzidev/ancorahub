/** One lead that got at least one follow-up (turbo reminder or silence follow-up) in the window. */
export type FollowupStatRow = {
  sent: number;
  skipped: number;
  stopReason: string | null;
  cadenceActive: boolean;
  replied: boolean;
  qualificationStatus: string | null;
  status: string;
};

export type FollowupStats = {
  scheduled: number;
  sent: number;
  responded: number;
  interrupted: number;
  conversionsPostFollowup: number;
  costPerRecoveryBrl: number;
};

/** Same estimate the Overview uses for WhatsApp cost per message. */
const COST_PER_MESSAGE_BRL = 0.035;
const INTERRUPTED = new Set(["opt_out", "meta_limit", "human"]);
const HOT = new Set(["hot", "qualified"]);
const ADVANCED = new Set(["quote_sent", "negotiation", "documentation_pending", "under_analysis", "converted"]);

export function summarizeFollowupStats(rows: readonly FollowupStatRow[]): FollowupStats {
  const withSend = rows.filter((row) => row.sent > 0);
  const sent = withSend.reduce((sum, row) => sum + row.sent, 0);
  const responded = withSend.filter((row) => row.replied).length;
  const recovered = withSend.filter((row) => row.replied && (HOT.has(row.qualificationStatus ?? "") || ADVANCED.has(row.status))).length;
  return {
    scheduled: rows.filter((row) => row.cadenceActive).length,
    sent,
    responded,
    interrupted: rows.filter((row) => INTERRUPTED.has(row.stopReason ?? "")).length,
    conversionsPostFollowup: recovered,
    costPerRecoveryBrl: recovered ? Number(((sent * COST_PER_MESSAGE_BRL) / recovered).toFixed(2)) : 0,
  };
}
