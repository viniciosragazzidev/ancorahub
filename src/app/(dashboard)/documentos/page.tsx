import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { DocumentsWorkspace } from "@/features/documents/components/documents-workspace";
import { DocumentsLite } from "@/features/documents/components/documents-lite";
import { ComercialPage } from "@/features/comercial-lite/comercial-kit";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import {
  getDocumentRequirements,
  getPendingDocuments,
} from "@/features/documents/actions";

export default async function DocumentsPage() {
  const context = await getRequiredTenantContext();
  const canAccess = await hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "acessar_documentos",
  });
  if (!canAccess) redirect("/access-denied");

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

  // Resumo da barra do topo (anatomia de página), só com a fila já carregada acima.
  const pendingCount = pendingDocs.filter((doc) => doc.status === "pending").length;
  const pageSummary = `${pendingCount.toLocaleString("pt-BR")} ${pendingCount === 1 ? "pendente" : "pendentes"} · ${pendingDocs.length.toLocaleString("pt-BR")} ${pendingDocs.length === 1 ? "documento" : "documentos"} na fila`;

  // Chave do diretor: a mesma tela (fila e requisitos) no visual Lite.
  if (await isDirectorLitePageOnServer(context, "/documentos")) {
    // Lite (28/11/2026, artifact "Comercial"): a moldura da área, com título, resumo e abas na página.
    return (
      <ComercialPage title="Documentos" summary={pageSummary}>
          <DocumentsLite
            carriers={carriers}
            plans={plans}
            initialRequirements={requirements}
            initialPendingDocs={pendingDocs.map((doc) => ({ ...doc, createdAt: new Date(doc.createdAt) }))}
            canConfigure={context.role === "director"}
            generatedAt={new Date()}
          />
      </ComercialPage>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Documentos" summary={pageSummary} />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
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
