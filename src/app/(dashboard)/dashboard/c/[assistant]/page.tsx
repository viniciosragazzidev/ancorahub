import { notFound, redirect } from "next/navigation";

import { AssistantChat } from "@/components/chat/assistant-chat";
import type { AssistantId } from "@/components/chat/types";
import { ASSISTANTS, buildAssistantScript } from "@/features/broker-workspace/chat/assistant-scripts";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

const SCRIPTED = ["leads", "plantao", "agenda", "desempenho"] as const;
type Scripted = (typeof SCRIPTED)[number];

/** One assistant conversation of the broker chat (Leads, Plantão, Agenda, Desempenho). */
export default async function AssistantConversationPage({ params }: { params: Promise<{ assistant: string }> }) {
  const { assistant } = await params;
  const context = await getRequiredTenantContext();
  if (context.role !== "broker" || (await getExperienceMode(context)) !== "LIGHT") redirect("/dashboard");
  if (!Object.hasOwn(ASSISTANTS, assistant)) notFound();
  const definition = ASSISTANTS[assistant as AssistantId];
  // Âncora, Cotação and Insights have their own screens.
  if (!SCRIPTED.includes(assistant as Scripted)) redirect(definition.href);
  const data = await getBrokerWorkspaceData();
  const script = buildAssistantScript(assistant as Scripted, { data, now: new Date() });
  return <AssistantChat identity={{ name: definition.name, shape: definition.shape, hue: definition.hue }} script={script} />;
}
