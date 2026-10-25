import { DashboardHeader } from "@/components/dashboard-header";
import Link from "next/link";
import { canSend, getAudienceOptions } from "@/features/relationship/audience";
import { BrokerMural } from "@/features/relationship/components/broker-mural";
import { RelationshipCenter } from "@/features/relationship/components/relationship-center";
import { RelationshipCenterLite } from "@/features/relationship/components/relationship-center-lite";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { listBroadcasts, listBrokerInbox } from "@/features/relationship/service";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { and, eq, isNull } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import { RelationshipJourneyTabs } from "@/features/relationship/components/relationship-journey-tabs";
import { getDirectorJourneyPageData } from "@/features/journey/director-queries";
import { createCampaign, pauseCampaign } from "@/features/journey/campaign-actions";
import { updateRule, restoreRules, reverseEvent } from "@/features/journey/director-actions";
import { RelationshipJourneyLite } from "@/features/relationship/components/director-lite/relationship-journey-lite";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import litePage from "@/components/lite/page/lite-page.module.css";

export const dynamic = "force-dynamic";

/**
 * One route for both sides (plan 2026-10-10-central-relacionamento-corretor):
 * director, manager and supervisor get the Central; the broker gets the mural.
 */
export default async function RelationshipPage({ searchParams }: { searchParams: Promise<{ brokerId?: string; leadId?: string; action?: string }> }) {
  const context = await getRequiredTenantContext();
  const supervisorLite = context.role === "supervisor" && (await getLiteAudience(context)) === "supervisor";
  const params = await searchParams;
  const enabled = (await getFeatureFlag(FEATURE_FLAGS.RELATIONSHIP_CENTER).catch(() => "false")) === "true";

  if (context.role === "director" || context.role === "manager") {
    const journeyEnabled = (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false")) === "true";
    const [messageData, data] = await Promise.all([
      enabled ? Promise.all([getAudienceOptions(context), listBroadcasts(context)]).then(([audienceOptions, broadcasts]) => [audienceOptions, broadcasts] as const) : Promise.resolve([null, []] as const),
      journeyEnabled ? getDirectorJourneyPageData(context) : Promise.resolve(null),
    ]);
    const [audienceOptions, broadcasts] = messageData;
    const historyItems = broadcasts.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
    // Diretor com a chave ligada e a rota fora do opt-out: mesmos dados e mesmas Server Actions, visual Lite.
    if (await isDirectorLitePageOnServer(context.role, context.tenantId, "/relacionamento")) {
      return (
        <>
          <DashboardHeader breadcrumb="Relacionamento" title="Central de relacionamento" />
          <main className={litePage.stack}>
            <RelationshipJourneyLite
              relationshipEnabled={enabled}
              journeyEnabled={journeyEnabled}
              options={audienceOptions}
              history={historyItems}
              data={data}
              actions={{ createCampaign, pauseCampaign, updateRule, restoreRules, reverseEvent }}
              today={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date())}
            />
          </main>
        </>
      );
    }
    return (
      <>
        <DashboardHeader breadcrumb="Relacionamento" title="Central de relacionamento" />
        <RelationshipJourneyTabs
          relationshipEnabled={enabled}
          journeyEnabled={journeyEnabled}
          options={audienceOptions}
          history={historyItems}
          data={data}
          actions={{ createCampaign, pauseCampaign, updateRule, restoreRules, reverseEvent }}
        />
      </>
    );
  }

  if (!enabled) {
    if (supervisorLite) {
      return (
        <div className="arc-venancor min-h-full bg-[var(--surface)] px-4 py-12">
          <EmptyState title="Recados ainda desligados" description="Os recados da gestão ainda não estão ligados. Quando ligarem, eles aparecem aqui." action={<Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--surface-muted)] px-5 text-sm font-medium" href="/dashboard">Voltar ao início</Link>} />
        </div>
      );
    }
    return (
      <>
        {supervisorLite ? null : <DashboardHeader breadcrumb="Relacionamento" title="Central de relacionamento" />}
        <div className={`mx-auto w-full max-w-3xl px-4 py-10 text-center text-sm ${supervisorLite ? "text-[var(--text-muted)]" : "text-muted-foreground"}`}>
          Os recados da gestão ainda não estão ligados. Quando ligarem, eles aparecem aqui.
          <div className="mt-3"><Link href="/dashboard" className="underline underline-offset-4">Voltar ao início</Link></div>
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
  let initialBrokerId: string | null = null;
  let initialTitle = "";
  let initialBody = "";
  let initialKind: "notice" | "recognition" = "notice";
  // Shortcuts from the team screens: "Mandar recado" and "Reconhecer" open with the broker chosen.
  if (supervisorLite && params.brokerId && !params.leadId && options.brokers.some((broker) => broker.id === params.brokerId)) {
    initialBrokerId = params.brokerId;
    if (params.action === "recognition") initialKind = "recognition";
  }
  if (supervisorLite && params.action === "reminder" && params.brokerId && params.leadId) {
    const [lead] = await getDatabase().select({ id: schema.leads.id, name: schema.leads.nome, brokerId: schema.leads.corretorId }).from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.id, params.leadId.slice(0, 80)), eq(schema.leads.corretorId, params.brokerId.slice(0, 80)), isNull(schema.leads.deletedAt), buildLeadScopeWhere(context))).limit(1);
    if (lead && options.brokers.some((broker) => broker.id === lead.brokerId)) {
      initialBrokerId = lead.brokerId;
      initialTitle = `Acompanhamento: ${lead.name}`.slice(0, 80);
      initialBody = `Oi, como está o atendimento de ${lead.name}?`.slice(0, 1000);
    }
  }
  const historyItems = history.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
  if (supervisorLite) {
    return <RelationshipCenterLite options={options} history={historyItems} initialBrokerId={initialBrokerId} initialKind={initialKind} initialTitle={initialTitle} initialBody={initialBody} />;
  }
  return (
    <>
      <DashboardHeader breadcrumb="Relacionamento" title="Central de relacionamento" />
      <RelationshipCenter
        options={options}
        history={historyItems}
        initialBrokerId={initialBrokerId}
        initialTitle={initialTitle}
        initialBody={initialBody}
      />
    </>
  );
}
