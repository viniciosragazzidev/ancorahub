"use client";

import { useDirectorLitePage } from "@/components/arc/use-director-lite-page";
import { DashboardHeader } from "@/components/dashboard-header";
import { useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { ConversationsBulkQualificationAction, ConversasHeaderNav } from "./_components/conversas-header-nav";
import { ConversationsWorkspace, type ConversationItem } from "./conversations-workspace";
import { OfficialBrokerConversations, type OfficialBrokerConversation } from "./official-broker-conversations";
import type { LeadTag } from "@/features/lead-tags/rules";
import styles from "./conversas-lite.module.css";

export function ConversationsFrame({
  role,
  branches,
  conversations,
  initialSyncCursor,
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
  distributedCount,
  coexLabel,
  officialBrokerTab,
}: {
  role: string;
  branches: { id: string; name: string }[];
  conversations: ConversationItem[];
  initialSyncCursor: { sentAt: string; id: string };
  initialLeadId?: string;
  userId?: string;
  tenantId?: string;
  leadTags: LeadTag[];
  canManageTags: boolean;
  officialBrokerEnabled: boolean;
  officialBrokerDeliveryChannel: "meta" | "waha_direct";
  officialBrokerConversations: OfficialBrokerConversation[];
  canSeeBrokerTab: boolean;
  currentTab: "leads" | "distribuidos" | "corretores" | "coex";
  leadsCount?: number;
  distributedCount?: number;
  coexLabel?: string | null;
  officialBrokerTab: boolean;
}) {
  const directorSkinEnabled = useDirectorLitePage();
  useRailWhileOpen(directorSkinEnabled);
  const pageActions = canSeeBrokerTab ? (
    <nav aria-label="Tipo de conversa" className="flex items-center gap-3">
      <ConversationsBulkQualificationAction />
      <ConversasHeaderNav currentTab={currentTab} leadsCount={leadsCount} distributedCount={distributedCount} coexLabel={coexLabel} segmented={directorSkinEnabled} />
    </nav>
  ) : null;
  // Resumo do topo (anatomia de página): as conversas que a aba aberta já carregou.
  const listed = officialBrokerTab ? officialBrokerConversations.length : conversations.length;
  const summary = `${listed.toLocaleString("pt-BR")} ${listed === 1 ? "conversa" : "conversas"}`;
  const header = (
    <DashboardHeader
      breadcrumb="Atendimento"
      title="Conversas"
      summary={summary}
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
      initialSyncCursor={initialSyncCursor}
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
      {/* Desenho "WhatsApp Web" (27/11/2026): no Lite o título fica dentro da lista; o topo só aparece na aba Corretores. */}
      {directorSkinEnabled && !officialBrokerTab ? null : header}
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

/**
 * Barra lateral só com os ícones enquanto a Conversas está aberta (27/11/2026, desenho "WhatsApp Web"): a conversa
 * ganha a largura. Ao sair da tela, a barra volta como estava.
 */
function useRailWhileOpen(enabled: boolean) {
  let sidebar: ReturnType<typeof useSidebar> | null = null;
  try {
    sidebar = useSidebar();
  } catch {
    sidebar = null;
  }
  const setOpen = sidebar?.setOpen;
  const isMobile = sidebar?.isMobile ?? true;
  const wasOpen = useRef<boolean | null>(null);
  const open = sidebar?.open;
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    if (!enabled || !setOpen || isMobile) return;
    wasOpen.current = openRef.current ?? true;
    setOpen(false);
    return () => {
      if (wasOpen.current) setOpen(true);
    };
  }, [enabled, setOpen, isMobile]);
}
