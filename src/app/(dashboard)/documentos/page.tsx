import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { DocumentsWorkspace } from "@/features/documents/components/documents-workspace";
import { DocumentsLite } from "@/features/documents/components/documents-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
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

  // Chave do diretor: a mesma tela (fila e requisitos) no visual Lite.
  if (await isDirectorLitePageOnServer(context, "/documentos")) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Documentos" />
        <main className={litePage.stack}>
          <DocumentsLite
            carriers={carriers}
            plans={plans}
            initialRequirements={requirements}
            initialPendingDocs={pendingDocs.map((doc) => ({ ...doc, createdAt: new Date(doc.createdAt) }))}
            canConfigure={context.role === "director"}
            generatedAt={new Date()}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Documentos" />
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
