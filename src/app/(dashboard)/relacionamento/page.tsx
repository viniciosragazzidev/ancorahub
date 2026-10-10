import { DashboardHeader } from "@/components/dashboard-header";
import { canSend, getAudienceOptions } from "@/features/relationship/audience";
import { BrokerMural } from "@/features/relationship/components/broker-mural";
import { RelationshipCenter } from "@/features/relationship/components/relationship-center";
import { listBroadcasts, listBrokerInbox } from "@/features/relationship/service";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/**
 * One route for both sides (plan 2026-10-10-central-relacionamento-corretor):
 * director, manager and supervisor get the Central; the broker gets the mural.
 */
export default async function RelationshipPage() {
  const context = await getRequiredTenantContext();
  const enabled = (await getFeatureFlag(FEATURE_FLAGS.RELATIONSHIP_CENTER).catch(() => "false")) === "true";

  if (!enabled) {
    return (
      <>
        <DashboardHeader breadcrumb="Relacionamento" title="Central de relacionamento" />
        <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
          A Central de relacionamento ainda não está ligada nesta empresa.
        </div>
      </>
    );
  }

  if (!canSend(context)) {
    const inbox = await listBrokerInbox(context);
    return (
      <BrokerMural
        items={inbox.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), readAt: item.readAt?.toISOString() ?? null, ackAt: item.ackAt?.toISOString() ?? null }))}
      />
    );
  }

  const [options, history] = await Promise.all([getAudienceOptions(context), listBroadcasts(context)]);
  return (
    <>
      <DashboardHeader breadcrumb="Relacionamento" title="Central de relacionamento" />
      <RelationshipCenter
        options={options}
        history={history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
      />
    </>
  );
}
