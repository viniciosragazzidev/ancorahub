import { DashboardHeader } from "@/components/dashboard-header";
import { getSituationsOverview } from "@/features/attendance-situations/service";
import { autoActivatedKeys, getLearningOverview } from "@/features/situation-learning/service";
import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AtendimentoHeading } from "../_components/atendimento-heading";
import { SituationsWorkspace } from "./_components/situations-workspace";

export const dynamic = "force-dynamic";

export const metadata = { title: "Situações - Atendimento" };

/**
 * "When the customer says X, this happens": the system's situations (with the
 * phrases the tenant taught), the tenant's own ones and the roteiros that
 * guide the AI, the AI's suggestions from the questions no situation covered,
 * plus a box to test any phrase against the real engine.
 */
export default async function AtendimentoSituacoesPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas Diretores e Gestores podem gerenciar as situações do atendimento.");
  }
  const [situations, learning, aiKeys, params] = await Promise.all([
    getSituationsOverview(context.tenantId),
    getLearningOverview(context.tenantId),
    autoActivatedKeys(context.tenantId),
    searchParams ?? Promise.resolve({} as { view?: string }),
  ]);

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Situações" />
      <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <AtendimentoHeading active="situacoes" />
        <SituationsWorkspace situations={situations} learning={learning} autoActivatedKeys={aiKeys} initialView={params.view} canConfigure={context.role === "director"} />
      </main>
    </>
  );
}
