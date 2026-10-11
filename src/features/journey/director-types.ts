/** Serializable UI contracts for T55. Dates are ISO strings or São Paulo calendar keys. */
import type { EngagementRule, EngagementRuleKey } from "@/features/engagement/catalog";
import type { JourneyMission, JourneyPointRuleKey, JourneyWeek, LeaderboardBroker, LeaderboardTeam, MissionMetric } from "@/features/engagement/journey-types";

export type JourneyActionResponse<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; message: string };

export type JourneyRuleTotal = { ruleKey: JourneyPointRuleKey; label: string; points: number; events: number };
export type JourneyAdoption = { activeBrokers: number; scoringBrokers: number; percentage: number };
export type JourneyUnitSummary = {
  branchId: string;
  branchName: string;
  points: number;
  adoption: JourneyAdoption;
  brokers: LeaderboardBroker[];
};
export type JourneyMissionCompletion = { missionId: string; title: string; kind: JourneyMission["kind"]; completed: number };
export type JourneyDirectorDashboard = {
  available: boolean;
  period: JourneyWeek;
  units: JourneyUnitSummary[];
  teams: LeaderboardTeam[];
  pointsByRule: JourneyRuleTotal[];
  adoption: JourneyAdoption;
  topMissions: JourneyMissionCompletion[];
};

export type JourneyAudienceOption = { id: string; name: string; branchId: string | null };
export type JourneyCampaignAudienceOptions = {
  available: boolean;
  branches: JourneyAudienceOption[];
  teams: JourneyAudienceOption[];
  duties: JourneyAudienceOption[];
  brokers: JourneyAudienceOption[];
};
export type CreateJourneyCampaignInput = {
  title: string;
  description?: string;
  metric: MissionMetric;
  target: number;
  bonusPoints: number;
  startsAt: string;
  endsAt: string;
  /** Optional selections narrow the authenticated creator's scope; they never grant access. */
  audience: { branchIds?: string[]; supervisorIds?: string[]; dutyScheduleIds?: string[]; userIds?: string[] };
};
export type JourneyCampaignRow = JourneyMission & { createdBy: string | null; createdAt: string };

export type RecognizeBrokerInput = { brokerId: string; points: number; reason: string };
export type JourneyRecognitionReceipt = { eventId: string; brokerId: string; points: number; remainingWeeklyPoints: number; replayed: boolean };
export type UpdateJourneyRuleInput = { ruleKey: EngagementRuleKey; enabled: boolean; points: number; dailyCap: number | null };
export type JourneyRulesData = { available: boolean; rules: EngagementRule[] };

export type JourneyRiskRule = JourneyRuleTotal & { zScore: number; outlier: boolean };
export type JourneyRiskBroker = { brokerId: string; name: string; branchId: string | null; points: number; rules: JourneyRiskRule[]; repeatedNotes: number; unusualContacts: number };
export type JourneyRiskEvent = { id: string; brokerId: string; brokerName: string; ruleKey: JourneyPointRuleKey; points: number; occurredAt: string; reversedAt: string | null; detail: string | null };
export type JourneyRiskReport = { available: boolean; period: JourneyWeek; brokers: JourneyRiskBroker[]; events: JourneyRiskEvent[] };
export type ReverseJourneyEventInput = { eventId: string; reason: string };

export type JourneyNearCompletion = { brokerId: string; brokerName: string; missionId: string; title: string; remaining: number; date: string; href: string };
