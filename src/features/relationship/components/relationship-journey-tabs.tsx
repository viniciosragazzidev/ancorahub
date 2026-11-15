"use client";

import { useState } from "react";
import { DsTabs, DsTabsList, DsTabsPanel, DsTabsTrigger } from "@/components/ui/ds-tabs";
import type { DirectorJourneyActions, DirectorJourneyData } from "@/features/journey/components/director/director-journey-panel";
import { DirectorJourneyPanel } from "@/features/journey/components/director/director-journey-panel";
import { RelationshipCenter } from "./relationship-center";
import { HomeAnnouncementEditor } from "@/features/home-announcement/components/home-announcement-editor";
import type { HomeAnnouncement } from "@/features/home-announcement/announcement";
import type { AudienceOptions } from "../audience";
import type { BroadcastSummary } from "../service";

type HistoryItem = Omit<BroadcastSummary, "createdAt"> & { createdAt: string };

export function RelationshipJourneyTabs({ relationshipEnabled, journeyEnabled, options, history, data, actions, announcement }: {
  relationshipEnabled: boolean;
  journeyEnabled: boolean;
  options: AudienceOptions | null;
  history: HistoryItem[];
  data: DirectorJourneyData | null;
  actions: DirectorJourneyActions;
  /** Aviso do Início (só diretor): a aba aparece quando vem. */
  announcement?: { initial: HomeAnnouncement | null; today: string } | null;
}) {
  const [tab, setTab] = useState("messages");
  return (
    <DsTabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <DsTabsList>
        <DsTabsTrigger value="messages">Mensagens</DsTabsTrigger>
        {journeyEnabled ? <DsTabsTrigger value="journey">Jornada da equipe</DsTabsTrigger> : null}
        {announcement ? <DsTabsTrigger value="announcement">Aviso do Início</DsTabsTrigger> : null}
      </DsTabsList>
      <DsTabsPanel value="messages">
        {relationshipEnabled && options ? <RelationshipCenter options={options} history={history} /> : (
          <div className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">A Central de relacionamento ainda não está ligada nesta empresa.</div>
        )}
      </DsTabsPanel>
      {journeyEnabled && data ? <DsTabsPanel value="journey"><DirectorJourneyPanel data={data} actions={actions} /></DsTabsPanel> : null}
      {announcement ? <DsTabsPanel value="announcement"><div className="arc-venancor mx-auto w-full max-w-4xl px-4 py-6"><HomeAnnouncementEditor initial={announcement.initial} today={announcement.today} /></div></DsTabsPanel> : null}
    </DsTabs>
  );
}
