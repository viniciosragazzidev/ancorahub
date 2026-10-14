import "server-only";

import { cache } from "react";
import { getBrokerJourneyData } from "@/features/engagement/journey-queries";

import type { ThreadSummary } from "@/components/chat/types";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { buildSupervisorLeadThreads, buildSupervisorThreads } from "@/features/supervisor-workspace/chat";
import { getSupervisorWorkspaceData } from "@/features/supervisor-workspace/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getManagerLiteLeads } from "@/features/supervisor-workspace/manager-lite-queries";

import { buildAssistantThreads, buildLeadThreads } from "./assistant-scripts";

/** One workspace load per request: the layout's rail and the Início page share it. */
export const getCachedBrokerWorkspaceData = cache(getBrokerWorkspaceData);
export const getCachedBrokerJourneyData = cache((tenantId: string, brokerId: string) => getBrokerJourneyData(tenantId, brokerId));

export type ChatRailData = {
  viewerName: string;
  assistants: ThreadSummary[];
  leads: ThreadSummary[];
  nowIso: string;
  canQuote: boolean;
  /** Waiting unit leads shown in the manager's Leads tab badge. */
  leadsBadgeCount?: number;
  managerUnitSummary?: { leads: number; unassigned: number; activeBrokers: number; brokersWithoutWhatsApp: number; inService: number; late: number };
};

/**
 * The conversation list of the broker app (assistants and leads), for the rail
 * that stays on the left of every Lite screen on computers. Null when the
 * workspace cannot load: the screens still work, only without the rail.
 */
/** One team load per request for the supervisor Lite (rail and Início share it). */
export const getCachedSupervisorWorkspaceData = cache(async () => getSupervisorWorkspaceData(await getRequiredTenantContext()));

export const getChatRailData = cache(async (): Promise<ChatRailData | null> => {
  try {
    const context = await getRequiredTenantContext();
    if (context.role === "supervisor") {
      const data = await getCachedSupervisorWorkspaceData();
      const now = new Date();
      return {
        viewerName: data.viewer.name,
        assistants: buildSupervisorThreads(data, now),
        leads: buildSupervisorLeadThreads(data, now),
        nowIso: now.toISOString(),
        canQuote: false,
      };
    }
    if (context.role === "manager" && (await getLiteAudience(context)) === "manager") {
      const data = await getManagerLiteLeads(context);
      const now = new Date();
      const waiting = data.leads.filter((lead) => !lead.ownerId).length;
      const inService = data.team.filter((member) => member.openCount > 0).length;
      const late = data.team.reduce((total, member) => total + member.late, 0);
      return {
        viewerName: data.viewerName,
        assistants: [
          { id: "assistant:equipe-leads", kind: "assistant", assistant: "equipe-leads", name: "Leads da unidade", verified: true, pinned: true, preview: waiting ? `${waiting} ${waiting === 1 ? "lead aguardando" : "leads aguardando"} distribuição manual.` : "Nenhum lead aguardando distribuição manual.", at: now.toISOString(), unread: false, waitingYou: waiting > 0, href: "/leads", shape: "favo", hue: 252 },
          { id: "assistant:equipe", kind: "assistant", assistant: "equipe", name: "Minha unidade", verified: true, preview: `${inService} ${inService === 1 ? "corretor" : "corretores"} em atendimento na unidade.`, at: now.toISOString(), unread: false, waitingYou: late > 0, href: "/equipe", shape: "mochi", hue: 150 },
          { id: "assistant:ancora", kind: "assistant", assistant: "ancora", name: "Notificações", verified: true, preview: "Avisos e atualizações da unidade.", at: now.toISOString(), unread: false, waitingYou: false, href: "/notificacoes", shape: "jack", hue: 175 },
        ],
        leads: [], nowIso: now.toISOString(), canQuote: false, leadsBadgeCount: waiting,
        managerUnitSummary: {
          leads: data.leads.length,
          unassigned: waiting,
          activeBrokers: data.team.length,
          brokersWithoutWhatsApp: data.brokersWithoutWhatsApp,
          inService: data.leads.filter((lead) => ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)).length,
          late,
        },
      };
    }
    const data = await getCachedBrokerWorkspaceData();
    const dutyCalendar = (await getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR).catch(() => "false")) === "true";
    const now = new Date();
    const journeyEnabled = (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false")) === "true";
    const journey = journeyEnabled ? await getCachedBrokerJourneyData(context.tenantId, context.userId).catch(() => null) : null;
    const capabilities = { quoteSimulator: true, dutyCalendar, journey: journeyEnabled };
    return {
      viewerName: data.viewer.name,
      assistants: buildAssistantThreads({ data, capabilities, journey, now }),
      leads: buildLeadThreads({ queue: data.queue, now }),
      nowIso: now.toISOString(),
      canQuote: capabilities.quoteSimulator,
    };
  } catch (error) {
    console.error("[chat-rail] Could not load the broker workspace", error);
    return null;
  }
});
