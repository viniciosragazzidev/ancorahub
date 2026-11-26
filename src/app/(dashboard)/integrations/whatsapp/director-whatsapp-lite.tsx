/** Visão da diretoria do WhatsApp no visual Lite: o canal, os avisos da equipe e o WhatsApp de cada corretor, com os dados já carregados pela visão. */
import type { ComponentProps } from "react";

import compat from "@/components/lite/page/lite-compat.module.css";
import litePage from "@/components/lite/page/lite-page.module.css";
import type { LinhaWhatsAppEquipe } from "@/features/whatsapp-equipe/situacao";

import { TeamNoticesCard } from "../whats_alt/_components/team-notices-card";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { TeamWhatsAppLite } from "./team-whatsapp-lite";
import { WhatsAppHeadingLite } from "./whatsapp-heading-lite";

type Notices = ComponentProps<typeof TeamNoticesCard>;

export function DirectorWhatsAppLite({ channel, notices, freeMessages, team = null }: { channel: ComponentProps<typeof TenantChannelCard>["initialChannel"]; notices: Notices["notices"]; freeMessages: Notices["freeMessages"]; team?: LinhaWhatsAppEquipe[] | null }) {
  return (
    <main className={litePage.stack}>
      <WhatsAppHeadingLite active="diretoria" canViewDirector />
      <div className={compat.compat}><TenantChannelCard initialChannel={channel} /></div>
      {team ? <TeamWhatsAppLite rows={team} /> : <p className={litePage.emptyText}>Não deu para carregar o WhatsApp da equipe agora. Recarregue a página para tentar de novo.</p>}
      <div className={compat.compat}><TeamNoticesCard notices={notices} freeMessages={freeMessages} channelConnected={channel?.status === "ready"} /></div>
    </main>
  );
}
