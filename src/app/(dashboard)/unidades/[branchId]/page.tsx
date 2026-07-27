import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnitProfileHeader } from "@/features/branches/components/unit-profile-header";
import { UnitMetricsCards } from "@/features/branches/components/unit-metrics-cards";
import { UnitMembersTable } from "@/features/branches/components/unit-members-table";
import { UnitTopBrokers } from "@/features/branches/components/unit-top-brokers";
import { getBranchProfileData } from "@/features/branches/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

type Props = {
  params: Promise<{ branchId: string }>;
};

export default async function UnitProfilePage({ params }: Props) {
  const context = await getRequiredTenantContext();

  const { branchId } = await params;

  // Authorization: director sees all; manager and broker only their branch.
  if (context.role !== "director") {
    if (!context.branchId || context.branchId !== branchId) {
      redirect("/access-denied");
    }
  }

  let data: Awaited<ReturnType<typeof getBranchProfileData>>;
  try {
    data = await getBranchProfileData(branchId);
  } catch (err) {
    if (err instanceof Error && err.message === "BRANCH_NOT_FOUND") {
      notFound();
    }
    // AuthorizationError from the query layer
    redirect("/access-denied");
  }

  const { branch, metrics, members, topBrokers } = data;

  // Determine where the back link should go per role.
  const backHref =
    context.role === "director"
      ? "/filiais"
      : context.role === "manager"
        ? "/gestor"
        : "/corretor";

  const canSeeTeam = context.role === "director" || context.role === "manager";

  return (
    <>
      <DashboardHeader breadcrumb="Unidade" title={branch.name} />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        {/* Page header with actions */}
        <UnitProfileHeader
          branch={branch}
          currentRole={context.role}
          backHref={backHref}
        />

        {/* Metrics strip — visible for all roles */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">
            Métricas da unidade
          </h2>
          <UnitMetricsCards metrics={metrics} />
        </section>

        {/* Body grid — team section only for director/manager */}
        {canSeeTeam && members !== null && topBrokers !== null ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Members table — 2/3 width on large screens */}
            <section className="lg:col-span-2" aria-labelledby="members-heading">
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle id="members-heading" className="text-base font-semibold">
                    Membros da unidade
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 pb-2">
                  <UnitMembersTable
                    members={members}
                    currentRole={context.role}
                  />
                </CardContent>
              </Card>
            </section>

            {/* Top brokers sidebar — 1/3 width */}
            <section aria-labelledby="top-brokers-heading">
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle id="top-brokers-heading" className="text-base font-semibold">
                    Ranking de conversão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UnitTopBrokers
                    topBrokers={topBrokers}
                    period={metrics.period}
                  />
                </CardContent>
              </Card>
            </section>
          </div>
        ) : (
          /* Broker sees a read-only summary card */
          <Card className="shadow-none">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Você está vinculado a esta unidade. Para detalhes de equipe e
                distribuição, consulte seu gestor.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
