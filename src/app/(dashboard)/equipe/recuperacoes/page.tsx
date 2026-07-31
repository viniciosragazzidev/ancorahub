import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { StatCard } from "@/components/dashboard/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { RecoveryRequestsTable } from "./recovery-requests-table";
import { dailyCounts } from "@/shared/trends";

export default async function PasswordRecoveryPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");

  const db = getDatabase();

  const requests = await db
    .select({
      id: schema.passwordResetRequests.id,
      userId: schema.passwordResetRequests.userId,
      userEmail: schema.passwordResetRequests.userEmail,
      status: schema.passwordResetRequests.status,
      createdAt: schema.passwordResetRequests.createdAt,
      reviewedAt: schema.passwordResetRequests.reviewedAt,
      directorNotes: schema.passwordResetRequests.directorNotes,
      userName: schema.user.name,
    })
    .from(schema.passwordResetRequests)
    .innerJoin(schema.user, eq(schema.passwordResetRequests.userId, schema.user.id))
    .where(eq(schema.passwordResetRequests.tenantId, context.tenantId))
    .orderBy(schema.passwordResetRequests.createdAt);

  const pendingCount = requests.filter((r) => r.status === "requested").length;

  const allTrend = dailyCounts(requests.map((r) => r.createdAt));
  const pendingTrend = dailyCounts(
    requests.filter((r) => r.status === "requested").map((r) => r.createdAt),
  );
  const resolvedTrend = dailyCounts(
    requests
      .filter((r) => r.status === "approved" || r.status === "rejected")
      .map((r) => r.reviewedAt ?? r.createdAt),
  );

  return (
    <>
      <DashboardHeader
        breadcrumb="Equipe"
        title="Recuperação de Senha"
      />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section>
          <p className="text-xs font-medium text-primary">SEGURANÇA</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Solicitações de recuperação</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Analise e aprove ou rejeite solicitações de recuperação de senha dos membros da equipe.
            Ao aprovar, um link de acesso único será enviado por WhatsApp para o solicitante.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Pendentes"
            value={pendingCount}
            sublabel="aguardando análise"
            valueClassName="text-amber-500"
            sparklineData={pendingTrend}
            sparklineColor="var(--warning)"
            animated
          />
          <StatCard
            label="Aprovadas"
            value={requests.filter((r) => r.status === "approved").length}
            sublabel="link enviado ao membro"
            valueClassName="text-emerald-500"
            sparklineData={resolvedTrend}
            sparklineColor="var(--chart-2)"
            animated
            animationDelay={0.06}
          />
          <StatCard
            label="Rejeitadas"
            value={requests.filter((r) => r.status === "rejected").length}
            sublabel="solicitações recusadas"
            valueClassName="text-red-500"
            sparklineData={allTrend}
            sparklineColor="var(--destructive)"
            animated
            animationDelay={0.12}
          />
        </div>

        <Card className="border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Solicitações recebidas</CardTitle>
            <CardDescription>
              {requests.length === 0
                ? "Nenhuma solicitação de recuperação de senha até o momento."
                : `${requests.length} solicitação(ões) registrada(s). As pendentes estão destacadas.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecoveryRequestsTable requests={requests} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
