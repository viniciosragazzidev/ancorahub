"use client";

/**
 * /relacionamento no visual Lite do diretor (chave ligada e rota fora do opt-out): as mesmas duas abas da tela de hoje
 * (RelationshipJourneyTabs), Mensagens e Jornada da equipe, com os mesmos dados e as mesmas Server Actions.
 * O título "Central de relacionamento" fica no topo da moldura; aqui não se repete.
 */
import { useState } from "react";

import page from "@/components/lite/page/lite-page.module.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DirectorJourneyActions, DirectorJourneyData } from "@/features/journey/components/director/director-journey-panel";

import type { AudienceOptions } from "../../audience";
import type { BroadcastSummary } from "../../service";
import { DirectorJourneyLite } from "./journey-lite";
import { RelationshipMessagesLite } from "./relationship-messages-lite";
import styles from "./relationship-lite.module.css";

type HistoryItem = Omit<BroadcastSummary, "createdAt"> & { createdAt: string };

export function RelationshipJourneyLite({ relationshipEnabled, journeyEnabled, options, history, data, actions }: {
  relationshipEnabled: boolean;
  journeyEnabled: boolean;
  options: AudienceOptions | null;
  history: HistoryItem[];
  data: DirectorJourneyData | null;
  actions: DirectorJourneyActions;
}) {
  const [tab, setTab] = useState("messages");
  return (
    <Tabs value={tab} onValueChange={setTab} variant="segment" className={styles.tabs}>
      <div className={styles.tabList}>
        <TabsList aria-label="Central de relacionamento" className="w-max">
          <TabsTrigger value="messages">Mensagens</TabsTrigger>
          {journeyEnabled ? <TabsTrigger value="journey">Jornada da equipe</TabsTrigger> : null}
        </TabsList>
      </div>
      <TabsContent value="messages" className={styles.panel}>
        {relationshipEnabled && options ? <RelationshipMessagesLite options={options} history={history} /> : (
          <div className={page.empty}>
            <p className={page.emptyTitle}>Central desligada</p>
            <p className={page.emptyText}>A Central de relacionamento ainda não está ligada nesta empresa.</p>
          </div>
        )}
      </TabsContent>
      {journeyEnabled && data ? <TabsContent value="journey" className={styles.panel}><DirectorJourneyLite data={data} actions={actions} /></TabsContent> : null}
    </Tabs>
  );
}
