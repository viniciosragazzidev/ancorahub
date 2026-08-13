import "server-only";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { AiAgentWizardClient } from "@/features/automations/components/ai-agent-wizard-client";

export const metadata = {
  title: "Assistente de IA - CRM Âncora Corretora",
  description: "Configure o assistente virtual inteligente e suas regras",
};

export default async function AgentesIaPage() {
  const context = await getRequiredTenantContext();

  // Protect page: Director and Manager can manage AI agent
  if (context.role !== "director" && context.role !== "manager") {
    redirect("/access-denied");
  }

  const db = getDatabase();
  const [config] = await db
    .select()
    .from(schema.aiQualificationConfigs)
    .where(eq(schema.aiQualificationConfigs.tenantId, context.tenantId))
    .limit(1);

  const initialConfig = {
    enabled: config?.enabled ?? false,
    assistantName: config?.assistantName ?? "Assistente Âncora Corretora",
    initialMessage: config?.initialMessage ?? "Olá! Como posso ajudar você hoje?",
    finalMessage: config?.finalMessage ?? "Obrigado! Um corretor continuará seu atendimento em seguida.",
    handoffMessage: config?.handoffMessage ?? "Vou encaminhar você para um corretor da equipe agora.",
    outOfHoursMessage: config?.outOfHoursMessage ?? "Recebemos sua mensagem. Nossa equipe responderá no próximo horário de atendimento.",
    absenceMessage: config?.absenceMessage ?? "No momento não há um corretor disponível. Deixaremos seu atendimento na fila.",
    language: (config?.language ?? "pt-BR") as "pt-BR" | "en" | "es",
    tone: (config?.tone ?? "friendly") as "friendly" | "professional" | "direct",
    useEmojis: config?.useEmojis ?? false,
    formOfAddress: (config?.formOfAddress ?? "voce") as "voce" | "primeiro_nome" | "senhor_senhora",
    maxQuestions: config?.maxQuestions ?? 6,
    businessContext: config?.businessContext ?? "",
    customInstructions: config?.customInstructions ?? "",
    requiredFields: (config?.requiredFields as string[]) || ["nome", "tipo_plano"],
  };

  return <AiAgentWizardClient initialConfig={initialConfig} />;
}
