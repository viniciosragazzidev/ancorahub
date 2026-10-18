import Link from "next/link";
import { notFound } from "next/navigation";

import { DutyNowView } from "@/features/broker-workspace/components/duty-now-view";
import { getCachedBrokerWorkspaceData } from "@/features/broker-workspace/chat/chat-rail-data";
import { getDutyNow } from "@/features/broker-workspace/duty-now";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** The broker's plantão happening now (opened from the Plantão conversation). */
export default async function DutyNowPage({ searchParams }: { searchParams: Promise<{ plantao?: string }> }) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") notFound();
  const now = new Date();
  const { plantao } = await searchParams;
  const [duty, workspace, calendarEnabled] = await Promise.all([
    getDutyNow(now, plantao).catch(() => null),
    getCachedBrokerWorkspaceData().catch(() => null),
    getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR).catch(() => "false"),
  ]);

  if (!duty) {
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
  );
}
