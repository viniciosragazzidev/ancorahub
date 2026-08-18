import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { LightFeedbackView } from "@/features/broker-workspace/components/light-feedback-view";

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
      phone={lead.telefone}
      currentStatus={lead.status}
    />
  );
}
