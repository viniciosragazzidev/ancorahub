import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { TeamInviteSection } from "../team-invite-section";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export default async function CreateTeamMemberPage() {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") redirect("/access-denied");

  const branches = await getDatabase()
    .select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(eq(schema.branches.tenantId, context.tenantId));

  return (
    <>
      <DashboardHeader breadcrumb="Gestao de equipe" title="Criar membro" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div>
          <p className="text-xs font-medium text-primary">GESTAO DE EQUIPE</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Criar membro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe apenas os dados básicos. A senha será criada pelo colaborador no primeiro acesso.
          </p>
        </div>
        <Card className="max-w-xl border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Novo Funcionário</CardTitle>
            <CardDescription>
              {context.role === "director"
                ? "Voce pode criar Gestores e Corretores."
                : "Voce pode criar apenas Corretores."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TeamInviteSection
              branches={branches}
              canInviteManager={context.role === "director"}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
