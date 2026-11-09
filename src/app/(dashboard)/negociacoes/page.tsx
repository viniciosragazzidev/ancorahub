import { redirect } from "next/navigation";

import { getNegotiationsDashboard, canAccessNegotiations } from "@/features/negotiations/queries";
import { NegotiationsDashboard } from "@/features/negotiations/negotiations-dashboard";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { canOpenNegotiations } from "@/features/negotiations/negotiation-scope";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getClosingOutcomesSummary } from "@/features/leads/closing-outcome-queries";
import { getNegotiationSnapshotHistory } from "@/features/negotiations/negotiation-snapshot";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function NegotiationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [context, params] = await Promise.all([getRequiredTenantContext(), searchParams]);
  const enabled = await getFeatureFlag(FEATURE_FLAGS.NEGOTIATIONS_AREA).catch(() => "false");
  if (!canOpenNegotiations(context.role, enabled === "true", hasPermission(context.role, "ver_dashboard_equipe")) || !canAccessNegotiations(context)) {
    redirect("/access-denied");
  }

  const [data, audience] = await Promise.all([
    getNegotiationsDashboard(context, single(params.unidade)),
    getLiteAudience(context).catch(() => null),
  ]);
  // Desfechos do fechamento (09/11): só o diretor, na unidade escolhida (ou na empresa toda).
  const branchId = data.scope.role === "director" && data.scope.branches.some((branch) => branch.id === single(params.unidade)) ? single(params.unidade)! : null;
  const [closingOutcomes, closingHistory] = context.role === "director"
    ? await Promise.all([
      getClosingOutcomesSummary({ tenantId: context.tenantId, branchId }).catch((error) => {
        console.error("[closing-outcome] summary_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        return null;
      }),
      // Foto diária do Fechamento (09/11): sem a tabela ou com erro, a faixa só não aparece.
      getNegotiationSnapshotHistory(context.tenantId).catch((error) => {
        console.error("[negotiation-snapshot] history_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
        return [];
      }),
    ])
    : [null, null];
  // Supervisor e gestor no app Light leem a conversa da equipe em /mensagens; os demais abrem a conversa em /conversas.
  const conversationMode = audience === "manager" || audience === "supervisor" ? "team" : "inbox";
  const activeTab = single(params.aba) === "estatisticas" ? "statistics" : "negotiations";
  return <NegotiationsDashboard data={data} activeTab={activeTab} generatedAt={new Date(data.generatedAt)} conversationMode={conversationMode} closingOutcomes={closingOutcomes} closingHistory={closingHistory} />;
}
