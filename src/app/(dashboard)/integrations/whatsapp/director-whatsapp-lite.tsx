/** Visão da diretoria do WhatsApp no visual Lite: o canal e os avisos da equipe, com os dados já carregados pela visão. */
import type { ComponentProps } from "react";

import compat from "@/components/lite/page/lite-compat.module.css";
import litePage from "@/components/lite/page/lite-page.module.css";

import { TeamNoticesCard } from "../whats_alt/_components/team-notices-card";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { WhatsAppHeadingLite } from "./whatsapp-heading-lite";

type Notices = ComponentProps<typeof TeamNoticesCard>;

export function DirectorWhatsAppLite({ channel, notices, freeMessages }: { channel: ComponentProps<typeof TenantChannelCard>["initialChannel"]; notices: Notices["notices"]; freeMessages: Notices["freeMessages"] }) {
  return (
    <main className={litePage.stack}>
      <WhatsAppHeadingLite active="diretoria" canViewDirector />
      <div className={compat.compat}><TenantChannelCard initialChannel={channel} /></div>
      <div className={compat.compat}><TeamNoticesCard notices={notices} freeMessages={freeMessages} channelConnected={channel?.status === "ready"} /></div>
    </main>
  );
}
