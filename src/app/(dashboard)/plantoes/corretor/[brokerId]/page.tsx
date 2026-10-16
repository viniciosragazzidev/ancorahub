import Link from "next/link";
import { notFound } from "next/navigation";

import { DutyNowView } from "@/features/broker-workspace/components/duty-now-view";
import { getBrokerDutyNowForViewer } from "@/features/broker-workspace/team-member-duty-now";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/**
 * The plantão of a broker of the viewer's scope, running now: the same screen the broker sees for himself.
 * Supervisor: own team. Gestor: own unit. Diretor: any broker. Outside the scope: not found.
 */
export default async function BrokerDutyPage({ params, searchParams }: { params: Promise<{ brokerId: string }>; searchParams: Promise<{ plantao?: string }> }) {
  const context = await getRequiredTenantContext();
  // Brokers have their own plantão page (/plantoes/agora).
  if (context.role === "broker") notFound();
  const { brokerId } = await params;
  const { plantao } = await searchParams;
  const now = new Date();
  const result = await getBrokerDutyNowForViewer({ brokerId, scheduleId: plantao, now });
  if (result.access === "denied") notFound();

  if (result.access === "idle") {
    return (
      <div className="arc-venancor" style={{ minHeight: "100%", background: "var(--surface)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px", textAlign: "center", display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 500 }}>Este corretor não está de plantão agora.</p>
          <Link href={context.role === "supervisor" ? "/equipe/minha" : "/equipe"} style={{ color: "var(--chat-action)", fontSize: "var(--text-sm)" }}>Voltar para a equipe</Link>
        </div>
      </div>
    );
  }

  const duty = result.duty;
  return (
    <DutyNowView
      nowIso={now.toISOString()}
      data={{
        ...duty,
        startsAt: duty.startsAt.toISOString(),
        endsAt: duty.endsAt.toISOString(),
        leads: duty.leads.map((lead) => ({ ...lead, at: lead.at.toISOString() })),
      }}
    />
  );
}
