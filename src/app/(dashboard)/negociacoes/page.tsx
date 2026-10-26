import { redirect } from "next/navigation";

import { getNegotiationsDashboard, canAccessNegotiations } from "@/features/negotiations/queries";
import { NegotiationsDashboard } from "@/features/negotiations/negotiations-dashboard";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { canOpenNegotiations } from "@/features/negotiations/negotiation-scope";

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

  const data = await getNegotiationsDashboard(context, single(params.unidade));
  const activeTab = single(params.aba) === "estatisticas" ? "statistics" : "negotiations";
  return <NegotiationsDashboard data={data} activeTab={activeTab} generatedAt={new Date(data.generatedAt)} />;
}
