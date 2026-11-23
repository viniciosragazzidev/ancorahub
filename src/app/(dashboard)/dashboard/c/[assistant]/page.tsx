import { notFound, redirect } from "next/navigation";

import { AssistantChat } from "@/components/chat/assistant-chat";
import type { AssistantId } from "@/components/chat/types";
import { ASSISTANTS, SUPERVISOR_ASSISTANTS, buildAncoraScript } from "@/features/broker-workspace/chat/assistant-scripts";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { brokerAiAccess } from "@/features/ai-gateway/broker-ai-pilot";
import { materialAsksOfTheDay } from "@/features/operator-catalog/answer";
import { isVoicePilotUser } from "@/features/sasa-voice/store";

export const dynamic = "force-dynamic";

/** Sasá remains the only assistant conversation; previous assistant URLs redirect to work pages. */
export default async function AssistantConversationPage({ params }: { params: Promise<{ assistant: string }> }) {
  const { assistant } = await params;
  const context = await getRequiredTenantContext();
  const audience = context.role === "supervisor" ? await getLiteAudience(context) : context.role === "broker" && (await getExperienceMode(context)) === "LIGHT" ? "broker" : null;
  if (!audience) redirect("/dashboard");
  if (!Object.hasOwn(ASSISTANTS, assistant)) notFound();
  const supervisorOnly = (SUPERVISOR_ASSISTANTS as readonly string[]).includes(assistant);
  // Each audience only has its own assistants (Âncora is shared).
  if (audience === "broker" && supervisorOnly) notFound();
  if (audience === "supervisor" && assistant !== "ancora" && !supervisorOnly) notFound();
  const definition = ASSISTANTS[assistant as AssistantId];
  if (assistant !== "ancora") redirect(definition.href);
  // A Sasá é só para pedidos ao assistente (19/11) e só o corretor escreve: o supervisor vê os avisos em Notificações.
  if (audience === "supervisor") redirect("/notificacoes");
  const identity = { name: definition.name, shape: definition.shape, hue: definition.hue };

  // Conversa só para pedidos à Sasá (19/11): os avisos ficam em /notificacoes, aberta pelo sino do Início.
  // Pilot of the operator RAG: questions made from the material this company has.
  const access = await brokerAiAccess(context.userId).catch(() => ({ enabled: false, operatorRag: false }));
  const materialAsks = access.operatorRag ? await materialAsksOfTheDay(context.tenantId).catch(() => []) : [];
  // Lembrete fixo "WhatsApp a partir de 20/10" removido em 05/11: a conexão é pedida ao confirmar presença.
  // Voz por ElevenLabs (teste de 23/11): só o corretor da lista vê o interruptor e ouve a Sasá.
  const voicePilot = await isVoicePilotUser(context.role, context.userId).catch(() => false);
  return <AssistantChat key="ancora" identity={identity} script={buildAncoraScript({ now: new Date(), materialAsks })} instant agentId="ancora" canWrite voice={access.enabled} voicePilot={voicePilot} />;
}
