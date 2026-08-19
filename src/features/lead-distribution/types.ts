export type LeadDistributionStatus = "unassigned" | "awaiting_unit" | "queued" | "assigning" | "assigned" | "distribution_failed" | "returned_to_queue";
export type AssignmentSource = "manual_director" | "manual_manager" | "automatic" | "duty_schedule" | "redistribution" | "system_recovery";
export type AssignmentStrategy = "round_robin" | "capacity" | "manual" | "duty_schedule";

export type LeadRoutingResult =
  | { status: "routed"; branchId: string; queueId: string | null; strategy: AssignmentStrategy; ruleId?: string }
  | { status: "inbox"; reason: string }
  | { status: "failed"; code: string }
  | { status: "conflict"; code: string }
  | { status: "campaign_conflict"; campaignId: string; queueName: string | null; targetBranchId: string };

export type LeadAssignmentResult =
  | { status: "assigned"; leadId: string; brokerId: string; strategy: AssignmentStrategy; notificationWarnings?: string[] }
  | { status: "queued"; leadId: string; reason: string }
  | { status: "conflict"; leadId: string; reason: string };
