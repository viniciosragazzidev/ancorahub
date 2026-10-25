/** Props do hub de qualificação (as mesmas na tela atual e na Lite). */
import type { WhatsAppConnectionDiagnostic } from "@/features/ai-qualification/whatsapp-diagnostic-service";
import type { QualificationStatsSummary } from "@/features/ai-qualification/stats-service";
import type { QualificationAlertRecord } from "@/features/ai-qualification/alerts-service";

export type QualificationHubProps = {
  settings: {
    enabled: boolean;
    pauseMode: string;
    assistantName: string;
    initialMessage: string;
    finalMessage?: string | null;
    handoffMessage: string;
    outOfHoursMessage: string;
    absenceMessage: string;
    tone: string;
    useEmojis: boolean;
    timeoutMinutes: number;
    businessContext?: string | null;
    customInstructions?: string | null;
    version: number;
    updatedAt: string | Date | null;
    quickReplyCooldownMinutes?: number | null;
    quickReplyWaitWindowMinutes?: number | null;
    quickReplyWaitLimitCount?: number | null;
  } | null;
  testNumbers: Array<{
    id: string;
    phoneNumber: string;
    label: string;
    active: boolean;
    autoResetMode: string;
  }>;
  whatsappDiagnostic: WhatsAppConnectionDiagnostic;
  followUpRules: Array<{
    id: string;
    name: string;
    enabled: boolean;
    trigger: string;
    delayMinutes: number;
    maxAttempts: number;
    minimumIntervalMinutes: number;
    allowedDays: any;
    allowedStartTime: string;
    allowedEndTime: string;
    timezone: string;
    messageMode: string;
    fixedMessage: string | null;
    templateId: string | null;
    stopConditions: any;
    destinationStatus: string | null;
  }>;
  toolPermissions: Array<{
    toolName: string;
    displayName: string;
    category: string;
    description: string;
    permission: string;
    maxCallsPerSession: number;
    requiresHumanConfirmation: boolean;
    isCritical: boolean;
  }>;
  destinationRules: Array<{
    id: string;
    temperatureClass: string;
    destinationType: string;
    destinationTargetId: string | null;
    priority: string;
    slaMinutes: number;
    fallbackDestinationType: string;
    sortOrder: number;
  }>;
  brokerProfiles: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    allowedLeadTypes: any;
    specialties: any;
    maxSimultaneousCapacity: number;
    dailyLimit: number;
    participatesInDuty: boolean;
    receivesOffHours: boolean;
    active: boolean;
    paused: boolean;
  }>;
  stats: QualificationStatsSummary;
  alerts: QualificationAlertRecord[];
  agentTraining: {
    enabled: boolean;
    canEdit: boolean;
    versions: Array<{ id: string; versionNumber: number; status: string; summary: string | null; validation: unknown; publishedAt: Date | null }>;
    brokers: Array<{ id: string; name: string }>;
    distributionPolicy: unknown;
  };
  canManageMessages: boolean;
};
