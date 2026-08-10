import type { PermissionKey } from "@/shared/auth/permissions";

export type ActionPriority = "critical" | "high" | "normal" | "low";

export type ActionType =
  | "navigate"
  | "open_modal"
  | "open_drawer"
  | "execute"
  | "start_conversation";

export type NextBestAction = {
  key: string;
  title: string;
  description?: string;
  priority: ActionPriority;
  actionType: ActionType;
  label: string;
  href?: string;
  iconName?: string;
  reason: string;
  ruleId: string;
  dueAt?: Date | string | null;
  entityType: "lead" | "quote" | "document" | "task" | "sale" | "team" | "system";
  entityId?: string;
  permission?: PermissionKey;
  secondaryActions?: NextBestAction[];
};

export type LeadActionContext = {
  id: string;
  name: string;
  status: string;
  qualificationStatus?: string | null;
  score?: number | null;
  phone?: string | null;
  hasSlaBreach?: boolean;
  slaMinutesRemaining?: number | null;
  hasActiveQuote?: boolean;
  hasSentQuote?: boolean;
  hasFollowUpScheduled?: boolean;
  followUpOverdue?: boolean;
  documentsPendingCount?: number;
  documentsApprovedCount?: number;
  totalDocumentsRequired?: number;
  hasCompletedSale?: boolean;
  lastInteractionAt?: Date | string | null;
  firstContactCompleted?: boolean;
  humanInterventionRequested?: boolean;
};

export type DashboardActionContext = {
  role: "broker" | "supervisor" | "manager" | "director";
  unattendedLeadsCount?: number;
  criticalSlaCount?: number;
  overdueTasksCount?: number;
  pendingDocumentsCount?: number;
  branchConversionDrop?: boolean;
};
