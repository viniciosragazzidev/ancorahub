import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { LightFeedbackView } from "@/features/broker-workspace/components/light-feedback-view";
import { lightContactFields } from "@/features/broker-workspace/lead-contact-privacy";

export const dynamic = "force-dynamic";

export default async function DashboardFeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [lead] = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      corretorId: schema.leads.corretorId,
      status: schema.leads.status,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);

  if (!lead) notFound();

  return (
    <LightFeedbackView
      leadId={lead.id}
      leadName={lead.nome}
      // Phone only after this broker accepted the lead (same rule as the lead screen).
      phone={lightContactFields(lead, { status: lead.status, isCurrentBroker: lead.corretorId === context.userId }).telefone}
      currentStatus={lead.status}
    />
  );
}
