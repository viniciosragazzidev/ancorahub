/** Shared, serializable contracts for the journey engines and the Lite UI. */
import type { EngagementRuleKey } from "./catalog";

export const JOURNEY_TIME_ZONE = "America/Sao_Paulo" as const;
export type JourneyPeriod = "daily" | "weekly" | "campaign";
export type MissionKind = "daily" | "weekly" | "team" | "campaign";
export type MissionMetric =
  | "contacts.fast_coverage"
  | "returns.cleared"
  | "notes.coverage"
  | "steps.coverage"
  | "offers.fast_coverage"
  | "contacts.days_on_time"
  | "contacts.evidenced"
  | "contacts.on_time"
  | "sla.no_breach";

export type MissionAudience = {
  branchIds?: string[];
  supervisorIds?: string[];
  dutyScheduleIds?: string[];
  userIds?: string[];
};

export type JourneyMission = {
  id: string;
  kind: MissionKind;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  bonusPoints: number;
  period: JourneyPeriod;
  audience: MissionAudience;
  startsAt: string | null;
  endsAt: string | null;
  status: "active" | "inactive";
};

/** All contact/note/return counts require persisted evidence, never a UI tap. */
export type JourneyDayFacts = {
  date: string;
  hasDuty: boolean;
  receivedLeads: number;
  evidencedContacts: number;
  fastContacts: number;
  onTimeContacts: number;
  offers: number;
  fastAcceptedOffers: number;
  serviceLeads: number;
  validNotes: number;
  returnsDue: number;
  returnsCompletedOnTime: number;
  overdueReturns: number;
  slaBreaches: number;
  confirmedPresence: boolean;
  /** Leads assigned that day, accepted for at least 30 minutes and still in the portfolio. */
  stageEligibleLeads?: number;
  stagedLeads?: number;
};

export type MissionProgress = {
  missionId: string;
  subjectId: string;
  periodKey: string;
  progress: number;
  target: number;
  percentage: number;
  remaining: number;
  eligible: boolean;
  completed: boolean;
  completedAt: string | null;
};

export type JourneyMissionCard = JourneyMission & { progress: MissionProgress; contribution?: number };
export type MissionBonus = {
  brokerId: string;
  missionId: string;
  periodKey: string;
  points: number;
  occurredAt: string;
  idempotencyKey: string;
};

export const ACHIEVEMENT_KEYS = [
  "lightning", "steady_duty", "first_sale", "family_protected",
  "business_cared", "returns_on_time", "nobody_waiting", "comeback",
] as const;
export type AchievementKey = (typeof ACHIEVEMENT_KEYS)[number];
export type AchievementEvidence = {
  fastContacts: number;
  consecutivePresences: number;
  approvedSales: number;
  approvedFamilySales: number;
  approvedBusinessSales: number;
  onTimeReturns: number;
  fullWeeksWithoutSlaBreach: number;
  approvedColdLeadSales: number;
};
export type JourneyAchievement = {
  key: AchievementKey;
  name: string;
  description: string;
  current: number;
  target: number;
  percentage: number;
  enabled: boolean;
  earned: boolean;
  earnedAt: string | null;
};

export type JourneyLevelName = "Iniciante" | "Consultor" | "Especialista" | "Referência" | "Mestre";
export type JourneyLevel = { index: number; name: JourneyLevelName; threshold: number };
export type JourneyLevelProgress = {
  level: JourneyLevel;
  nextLevel: JourneyLevel | null;
  totalPoints: number;
  pointsInLevel: number;
  pointsToNext: number;
  percentage: number;
};
export type JourneyStreak = { current: number; best: number; lastDutyDate: string | null };

export type JourneyWeek = { periodKey: string; startsAt: string; endsAt: string };
export type BrokerWeekSummary = JourneyWeek & {
  brokerId: string;
  points: number;
  previousPoints: number;
  pointsChange: number;
  totalPoints: number;
};
export type LeaderboardBroker = {
  brokerId: string;
  name: string;
  imageUrl: string | null;
  branchId: string | null;
  supervisorId: string | null;
  points: number;
  previousPoints: number;
  position: number;
  previousPosition: number | null;
  positionChange: number | null;
  optedOut: boolean;
};
export type UnitLeaderboard = JourneyWeek & {
  topThree: LeaderboardBroker[];
  self: LeaderboardBroker | null;
  gapToNext: number | null;
  totalParticipants: number;
};
export type LeaderboardTeam = {
  supervisorId: string;
  name: string;
  imageUrl: string | null;
  branchId: string | null;
  activeBrokers: number;
  totalPoints: number;
  averagePoints: number;
  previousAveragePoints: number;
  position: number;
  previousPosition: number | null;
  positionChange: number | null;
};
export type TeamLeaderboard = JourneyWeek & { teams: LeaderboardTeam[] };
export type TeamInternalLeaderboard = JourneyWeek & {
  supervisorId: string;
  brokers: LeaderboardBroker[];
};

export type JourneyPointRuleKey = EngagementRuleKey | "mission.completed" | "recognition.bonus";
export type JourneyCelebrationPayload =
  | { kind: "points"; points: number; ruleKey: JourneyPointRuleKey; label: string; detail?: string }
  | { kind: "mission"; missionId: string; title: string; bonusPoints: number; periodKey: string }
  | { kind: "achievement"; badgeKey: AchievementKey; name: string }
  | { kind: "level"; level: JourneyLevel; totalPoints: number }
  | { kind: "daily_summary"; date: string; received: number; onTimeContacts: number; points: number };
export type JourneyCelebration = {
  id: string;
  userId: string;
  kind: JourneyCelebrationPayload["kind"];
  payload: JourneyCelebrationPayload;
  /** Larger numbers win; the UI keeps lead offers and SLA alerts ahead of these. */
  priority: number;
  createdAt: string;
  seenAt: string | null;
};

export type BrokerJourneyData = {
  available: boolean;
  optedOut: boolean;
  ledger: {
    id: string;
    ruleKey: JourneyPointRuleKey;
    label: string;
    detail: string | null;
    points: number;
    occurredAt: string;
    reversed: boolean;
  }[];
  week: BrokerWeekSummary;
  level: JourneyLevelProgress;
  streak: JourneyStreak;
  missions: JourneyMissionCard[];
  achievements: JourneyAchievement[];
  leaderboard: UnitLeaderboard | null;
  celebrations: JourneyCelebration[];
};
