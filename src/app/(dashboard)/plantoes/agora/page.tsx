import Link from "next/link";
import { notFound } from "next/navigation";

import { PresenceCalloutList } from "@/components/chat/presence-callout";
import { DutyNowView } from "@/features/broker-workspace/components/duty-now-view";
import { presenceAsksOf, presenceScheduleIdFor } from "@/features/broker-workspace/chat/assistant-scripts";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { getDutyNow } from "@/features/broker-workspace/duty-now";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** The broker's plantão happening now (opened from the Plantão conversation). */
export default async function DutyNowPage({ searchParams }: { searchParams: Promise<{ plantao?: string | string[]; assignment?: string | string[] }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") notFound();
  const now = new Date();
  const { plantao, assignment } = await searchParams;
  const [workspace, calendarEnabled] = await Promise.all([
    getCachedBrokerWorkspaceData().catch(() => null),
    getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR).catch(() => "false"),
  ]);
  const assignmentId = typeof assignment === "string" ? assignment : undefined;
  const scheduleId = workspace ? presenceScheduleIdFor(workspace, assignmentId) : null;
  // Only a link that is not this broker's is a 404; a failed workspace load falls back to ?plantao=.
  if (workspace && assignmentId && !scheduleId) notFound();
  const duty = await getDutyNow(now, scheduleId ?? (typeof plantao === "string" ? plantao : undefined)).catch(() => null);

  // The presence link (WhatsApp reminder, "Abrir o app e tirar a foto") lands here: the photo has to be here too,
  // also before the start, when the plantão is not "now" yet (20/10: brokers saw "não está de plantão" and no camera).
  const asks = workspace ? presenceAsksOf(workspace, assignmentId) : [];
  const presence = asks.length
    ? <div className="arc-venancor" style={{ maxWidth: 560, margin: "0 auto", padding: "16px 16px 0" }}><PresenceCalloutList asks={asks} variant="chat" /></div>
    : null;

  if (!duty) {
    if (presence) return <div className="arc-venancor" style={{ minHeight: "100%", background: "var(--surface)", paddingTop: 32 }}>{presence}</div>;
    return (
      <div className="arc-venancor" style={{ minHeight: "100%", background: "var(--surface)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px", textAlign: "center", display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 500 }}>Você não está de plantão agora.</p>
          {workspace?.duty?.next ? <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>Próximo: {workspace.duty.next.scheduleName}, {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${workspace.duty.next.dutyDate}T12:00:00-03:00`))}, {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(workspace.duty.next.startsAt)} às {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(workspace.duty.next.endsAt)}.</p> : null}
          {calendarEnabled === "true" ? <Link href="/plantoes" style={{ color: "var(--chat-action)", fontSize: "var(--text-sm)" }}>Ver plantões e minha escala</Link> : null}
        </div>
      </div>
    );
  }

  return (
    <>
    {presence}
    <DutyNowView
      nowIso={now.toISOString()}
      data={{
        ...duty,
        startsAt: duty.startsAt.toISOString(),
        endsAt: duty.endsAt.toISOString(),
        leads: duty.leads.map((lead) => ({ ...lead, at: lead.at.toISOString() })),
      }}
      canManageAvailability={context.role === "broker"}
    />
    </>
  );
}
