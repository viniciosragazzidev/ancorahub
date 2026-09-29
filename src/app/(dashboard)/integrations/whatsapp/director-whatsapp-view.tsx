import { and, desc, eq } from "drizzle-orm";

import { resolveNoticeTextVariants } from "@/features/communication-channels/outbound-service";
import { TEAM_NOTICES } from "@/features/team-notices/catalog";
import { getTeamNoticeSettings } from "@/features/team-notices/service";
import { getTenantChannel } from "@/features/waha-cadence/tenant-channel";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { TeamNoticesCard, type TeamNoticeRow } from "../whats_alt/_components/team-notices-card";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { WhatsAppIntegrationHeading } from "./whatsapp-integration-heading";

/** Example values for the preview of each notice's built-in versions (same order as the outbox variables). */
const PREVIEW_VARIABLES: Record<string, string[]> = {
  brokerLeadNotification: ["Corretor", "Ana", "Maria Souza", "Plano de saúde", "exemplo"],
  newLeadAssignment: ["Corretor", "Ana", "Maria Souza", "Plano de saúde", "exemplo"],
  leadAssignmentConfirmed: ["Ana", "Maria Souza", "(21) 99999-0000", "Plano de saúde", "Individual", "2", "Rio de Janeiro", "exemplo"],
  leadAssignmentUnavailable: ["Ana"],
  leadAssignmentExpired: ["Ana"],
  leadFeedbackReminder: ["Ana", "Maria Souza"],
  taskReminder: ["Ana", "Ligar para Maria Souza", "Hoje, 15:00"],
  brokerAccountActivated: ["Ana", "Âncora"],
  dutyPresenceConfirmation: ["Ana", "08:00", "exemplo"],
};

export async function DirectorWhatsAppView({ context }: { context: TenantContext }) {
  const [channel, settings, freeMessages] = await Promise.all([
    getTenantChannel(context),
    getTeamNoticeSettings(context.tenantId),
    getDatabase()
      .select({ id: schema.messageTemplates.id, name: schema.messageTemplates.name, content: schema.messageTemplates.content })
      .from(schema.messageTemplates)
      .where(and(eq(schema.messageTemplates.tenantId, context.tenantId), eq(schema.messageTemplates.active, true)))
      .orderBy(desc(schema.messageTemplates.updatedAt)),
  ]);

  const notices: TeamNoticeRow[] = TEAM_NOTICES.map((notice) => {
    const setting = settings.get(notice.key)!;
    return {
      key: notice.key,
      label: notice.label,
      description: notice.description,
      metaOnly: Boolean(notice.metaOnly),
      alwaysOn: Boolean(notice.alwaysOn),
      chat: Boolean(notice.chat),
      immediate: notice.class === "critical",
      enabled: setting.enabled,
      channel: setting.channel,
      freeMessageIds: setting.freeMessageIds,
      builtInPreviews: notice.chat || notice.metaOnly ? [] : resolveNoticeTextVariants(notice.purpose, PREVIEW_VARIABLES[notice.purpose] ?? []),
    };
  });

  return <main className="flex min-h-full flex-col gap-5 bg-background p-(--mobile-page-padding) antialiased sm:gap-6 lg:p-6">
    <WhatsAppIntegrationHeading active="diretoria" canViewDirector />
    <div className="mx-auto grid w-full max-w-7xl gap-5 sm:gap-6">
      <TenantChannelCard initialChannel={channel} />
      <TeamNoticesCard notices={notices} freeMessages={freeMessages} channelConnected={channel?.status === "ready"} />
    </div>
  </main>;
}
