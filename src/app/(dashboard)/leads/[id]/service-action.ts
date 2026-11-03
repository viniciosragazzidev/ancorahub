"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { startBrokerLeadService } from "@/features/leads/start-lead-service";
import { loadBrokerGreetingSafe } from "@/features/leads/broker-greeting-server";
import { buildWhatsAppUrl } from "@/lib/whatsapp-url";

export type StartLeadServiceState = { success?: boolean; error?: string; whatsappUrl?: string };

export async function startLeadServiceAction(_prev: StartLeadServiceState, formData: FormData): Promise<StartLeadServiceState> {
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { error: "ID do lead não fornecido." };

  try {
    const context = await getRequiredTenantContext();
    // Mesmo serviço da extensão (features/leads/start-lead-service): regras e notificações ficam em um lugar só.
    const started = await startBrokerLeadService(context, leadId);
    if (!started.ok) return { error: started.error };
    const lead = started.lead;

    revalidatePath("/leads");
    revalidatePath("/leads/distribuicao");
    revalidatePath("/minha-fila");

    // WhatsApp Web straight in the chat with the greeting written (the click handler swaps it for the app on a phone).
    return { success: true, whatsappUrl: buildWhatsAppUrl(lead.telefone, await loadBrokerGreetingSafe({ tenantId: context.tenantId, leadId: lead.id, brokerUserId: context.userId, leadName: lead.nome })) ?? undefined };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível iniciar o atendimento." };
  }
}
