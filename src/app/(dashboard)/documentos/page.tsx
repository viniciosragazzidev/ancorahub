import { and, eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { DocumentsWorkspace } from "@/features/documents/components/documents-workspace";
import {
  getDocumentRequirements,
  getPendingDocuments,
} from "@/features/documents/actions";

export default async function DocumentsPage() {
  const context = await getRequiredTenantContext();

  const db = getDatabase();

  const [carriers, plans, requirements, pendingDocs] = await Promise.all([
    db
      .select({ id: schema.carriers.id, name: schema.carriers.name })
      .from(schema.carriers)
      .where(and(eq(schema.carriers.tenantId, context.tenantId), eq(schema.carriers.status, "active")))
      .orderBy(schema.carriers.name),
    db
      .select({
        id: schema.carrierPlans.id,
        name: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
      })
      .from(schema.carrierPlans)
      .innerJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(
        and(
          eq(schema.carrierPlans.tenantId, context.tenantId),
          eq(schema.carrierPlans.active, true),
          eq(schema.carriers.status, "active")
        )
      )
      .orderBy(schema.carriers.name, schema.carrierPlans.name),
    getDocumentRequirements(),
    getPendingDocuments(),
  ]);

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Documentos" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section>
          <p className="text-xs font-medium text-primary">OPERAÇÃO COMERCIAL</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Gestão Documental</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe pendências de documentos enviados pelos corretores e configure exigências obrigatórias.
          </p>
        </section>

        <DocumentsWorkspace
          role={context.role}
          carriers={carriers}
          plans={plans}
          initialRequirements={requirements}
          initialPendingDocs={pendingDocs.map((doc) => ({
            ...doc,
            createdAt: new Date(doc.createdAt),
          }))}
        />
      </main>
    </>
  );
}
