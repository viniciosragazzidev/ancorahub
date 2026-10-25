"use client";

import { useDirectorLitePage } from "@/components/arc/use-director-lite-page";
import { DashboardHeader } from "@/components/dashboard-header";
import { ConversationsBulkQualificationAction, ConversasHeaderNav } from "./_components/conversas-header-nav";
import { ConversationsWorkspace, type ConversationItem } from "./conversations-workspace";
import { OfficialBrokerConversations, type OfficialBrokerConversation } from "./official-broker-conversations";
import type { LeadTag } from "@/features/lead-tags/rules";
import styles from "./conversas-lite.module.css";

export function ConversationsFrame({
  role,
  branches,
  conversations,
  initialLeadId,
  userId,
  tenantId,
  leadTags,
  canManageTags,
  officialBrokerEnabled,
  officialBrokerDeliveryChannel,
  officialBrokerConversations,
  canSeeBrokerTab,
  currentTab,
  leadsCount,
  coexLabel,
  officialBrokerTab,
}: {
  role: string;
  branches: { id: string; name: string }[];
  conversations: ConversationItem[];
  initialLeadId?: string;
  userId?: string;
  tenantId?: string;
  leadTags: LeadTag[];
  canManageTags: boolean;
  officialBrokerEnabled: boolean;
  officialBrokerDeliveryChannel: "meta" | "waha_direct";
  officialBrokerConversations: OfficialBrokerConversation[];
  canSeeBrokerTab: boolean;
  currentTab: "leads" | "corretores" | "coex";
  leadsCount?: number;
  coexLabel?: string | null;
  officialBrokerTab: boolean;
}) {
  const directorSkinEnabled = useDirectorLitePage();
  const pageActions = canSeeBrokerTab ? (
    <nav aria-label="Tipo de conversa" className="flex items-center gap-3">
      <ConversationsBulkQualificationAction />
      <ConversasHeaderNav currentTab={currentTab} leadsCount={leadsCount} coexLabel={coexLabel} />
    </nav>
  ) : null;
  const header = (
    <DashboardHeader
      breadcrumb="Atendimento"
      title="Conversas"
      rightSlot={directorSkinEnabled ? undefined : pageActions}
    />
  );
  const page = officialBrokerTab ? (
    <OfficialBrokerConversations
      enabled={officialBrokerEnabled}
      deliveryChannel={officialBrokerDeliveryChannel}
      conversations={officialBrokerConversations}
    />
  ) : (
    <ConversationsWorkspace
      role={role}
      branches={branches}
      conversations={conversations}
      initialLeadId={initialLeadId}
      userId={userId}
      tenantId={tenantId}
      leadTags={leadTags}
      canManageTags={canManageTags}
      canSeeBrokerTab={canSeeBrokerTab}
      currentTab={currentTab === "corretores" ? "leads" : currentTab}
      coexLabel={coexLabel}
    />
  );

  return (
    <div
      className={`arc-venancor ${styles.root} flex h-app min-h-0 w-full flex-1 flex-col overflow-hidden`}
      data-skin={directorSkinEnabled ? "diretor" : undefined}
    >
      {header}
      <main
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background p-0"
        data-conversations-part={directorSkinEnabled ? "content" : undefined}
      >
        {directorSkinEnabled && officialBrokerTab && pageActions ? (
          <div data-conversations-part="page-actions" className="shrink-0">
            {pageActions}
          </div>
        ) : null}
        <div
          data-lite={directorSkinEnabled ? undefined : "frame"}
          data-conversations-part={directorSkinEnabled ? "frame" : undefined}
          className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card"
        >
          {page}
        </div>
      </main>
    </div>
  );
}
