import { redirect } from "next/navigation";
import Link from "next/link";

import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { getBrokerJourneyData } from "@/features/engagement/journey-queries";
import { JourneyScreen } from "@/features/journey/components/journey-screen";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** Minha jornada (Lite of the broker): level, missions, unit board, achievements and the points ledger. */
export default async function JourneyPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") redirect("/dashboard");
  const enabled = (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false")) === "true";
  if (!enabled) redirect("/dashboard");

  const data = await getBrokerJourneyData(context.tenantId, context.userId).catch(() => null);
  if (!data || !data.available) {
    return (
      <div className="arc-venancor min-h-full bg-[var(--surface)] px-4 py-16">
        <EmptyState
          title="Seus pontos não abriram agora"
          description="Tente de novo em alguns minutos. Nada do que você fez se perdeu."
          action={<Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--surface-muted)] px-5 text-sm font-medium text-[var(--foreground)]" href="/jornada">Tentar de novo</Link>}
        />
      </div>
    );
  }
  return <JourneyScreen data={data} />;
}
