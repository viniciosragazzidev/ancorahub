export type LeadDistributionStatus = "unassigned" | "awaiting_unit" | "queued" | "assigning" | "assigned" | "distribution_failed" | "returned_to_queue" | "manual_hold";
export type AssignmentSource = "manual_director" | "manual_manager" | "automatic" | "automatic_offer" | "manual_offer" | "duty_schedule" | "redistribution" | "system_recovery";
export type AssignmentStrategy = "round_robin" | "capacity" | "manual" | "duty_schedule" | "whatsapp_offer";
export const dutyFallbackPolicyValues = ["unit_roster", "wait_next_duty", "fallback_queue"] as const;
export type DutyFallbackPolicy = (typeof dutyFallbackPolicyValues)[number];

export type LeadRoutingResult =
  | { status: "routed"; branchId: string; queueId: string | null; strategy: AssignmentStrategy; ruleId?: string }
  | { status: "inbox"; reason: string }
  | { status: "failed"; code: string }
  | { status: "conflict"; code: string }
  | { status: "campaign_conflict"; campaignId: string; queueName: string | null; targetBranchId: string };

export type LeadAssignmentResult =
  | { status: "assigned"; leadId: string; brokerId: string; strategy: AssignmentStrategy; notificationWarnings?: string[] }
  | { status: "offered"; leadId: string; brokerId: string; expiresAt: Date; reason: string; outboundMessageId?: string }
  | { status: "manual_required"; leadId: string; reason: string }
  | { status: "queued"; leadId: string; reason: string }
  | { status: "conflict"; leadId: string; reason: string };
