import { and, desc, eq } from "drizzle-orm";

import { resolveNoticeTextVariants } from "@/features/communication-channels/outbound-service";
import { isDutyShiftReminderEnabled } from "@/features/lead-distribution/duty-shift-reminder-flag";
import { formatRecipientPhone } from "@/features/leads/closing-director-alert-core";
import { getNoticeRecipients } from "@/features/leads/closing-director-alert";
import { teamNoticesFor } from "@/features/team-notices/catalog";
import { noticeTestable } from "@/features/team-notices/deliveries";
import { PREVIEW_VARIABLES } from "@/features/team-notices/preview-variables";
import { getTeamNoticeSettings } from "@/features/team-notices/service";
import { getTenantChannel } from "@/features/waha-cadence/tenant-channel";
import { getWhatsAppDaEquipe } from "@/features/whatsapp-equipe/queries";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { TeamNoticesCard, type TeamNoticeRow } from "../whats_alt/_components/team-notices-card";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { WhatsAppIntegrationHeading } from "./whatsapp-integration-heading";
import { DirectorWhatsAppLite } from "./director-whatsapp-lite";

export async function DirectorWhatsAppView({ context, lite = false }: { context: TenantContext; lite?: boolean }) {
  // Só o Lite mostra o WhatsApp da equipe; começa junto com o resto e, se falhar, a seção avisa sem derrubar a página.
  const teamPromise = lite ? getWhatsAppDaEquipe(context).catch(() => null) : null;
  const [channel, settings, freeMessages, dutyReminderEnabled, recipientsByNotice] = await Promise.all([
    getTenantChannel(context),
    getTeamNoticeSettings(context.tenantId),
    getDatabase()
      .select({ id: schema.messageTemplates.id, name: schema.messageTemplates.name, content: schema.messageTemplates.content })
      .from(schema.messageTemplates)
      .where(and(eq(schema.messageTemplates.tenantId, context.tenantId), eq(schema.messageTemplates.active, true)))
      .orderBy(desc(schema.messageTemplates.updatedAt)),
    isDutyShiftReminderEnabled(context.tenantId),
    Promise.all(teamNoticesFor(true).filter((notice) => notice.phoneRecipients).map(async (notice) => [notice.key, await getNoticeRecipients(context.tenantId, notice.key)] as const))
      .then((entries) => new Map(entries)),
  ]);

  const notices: TeamNoticeRow[] = teamNoticesFor(dutyReminderEnabled).map((notice) => {
    const setting = settings.get(notice.key)!;
    return {
      key: notice.key,
      label: notice.label,
      description: notice.description,
      metaOnly: Boolean(notice.metaOnly),
      alwaysOn: Boolean(notice.alwaysOn),
      chat: Boolean(notice.chat),
      immediate: notice.class === "critical",
      testable: noticeTestable(notice),
      enabled: setting.enabled,
      channel: setting.channel,
      freeMessageIds: setting.freeMessageIds,
      recipientPhones: notice.phoneRecipients ? (recipientsByNotice.get(notice.key) ?? []).map(formatRecipientPhone) : undefined,
      builtInPreviews: notice.chat || notice.metaOnly ? [] : resolveNoticeTextVariants(notice.purpose, PREVIEW_VARIABLES[notice.purpose] ?? []),
    };
  });

  // Visual Lite: os mesmos cartões (canal e avisos), na página Lite com a troca de visão em chips, e o WhatsApp da equipe.
  if (lite) {
    const team = await teamPromise;
    return <DirectorWhatsAppLite channel={channel} notices={notices} freeMessages={freeMessages} team={team} />;
  }

  return <main className="flex min-h-full flex-col gap-5 bg-background p-(--mobile-page-padding) antialiased sm:gap-6 lg:p-6">
    <WhatsAppIntegrationHeading active="diretoria" canViewDirector />
    <div className="mx-auto grid w-full max-w-7xl gap-5 sm:gap-6">
      <TenantChannelCard initialChannel={channel} />
      <TeamNoticesCard notices={notices} freeMessages={freeMessages} channelConnected={channel?.status === "ready"} />
    </div>
  </main>;
}
