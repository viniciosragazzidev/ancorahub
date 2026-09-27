import { and, desc, eq } from "drizzle-orm";

import { TEAM_NOTICES } from "@/features/team-notices/catalog";
import { getTeamNoticeSettings } from "@/features/team-notices/service";
import { getTenantChannel } from "@/features/waha-cadence/tenant-channel";
import { companyNumberNoticesEnabled } from "@/features/waha-cadence/tenant-channel-routing";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { TeamNoticesCard, type TeamNoticeRow } from "../whats_alt/_components/team-notices-card";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { WhatsAppIntegrationHeading } from "./whatsapp-integration-heading";

export async function DirectorWhatsAppView({ context }: { context: TenantContext }) {
  const [channel, settings, companyNumberOn, freeMessages] = await Promise.all([
    getTenantChannel(context),
    getTeamNoticeSettings(context.tenantId),
    companyNumberNoticesEnabled(context.tenantId),
    getDatabase()
      .select({ id: schema.messageTemplates.id, name: schema.messageTemplates.name })
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
      immediate: notice.class === "critical",
      enabled: setting.enabled,
      channel: setting.channel,
      freeMessageId: setting.freeMessageId,
    };
  });

  return <main className="flex min-h-full flex-col gap-5 bg-background p-(--mobile-page-padding) antialiased sm:gap-6 lg:p-6">
    <WhatsAppIntegrationHeading active="diretoria" canViewDirector />
    <div className="mx-auto grid w-full max-w-7xl gap-5 sm:gap-6">
      <TenantChannelCard initialChannel={channel} />
      <TeamNoticesCard notices={notices} freeMessages={freeMessages} channelConnected={channel?.status === "ready"} companyNumberOn={companyNumberOn} />
    </div>
  </main>;
}
