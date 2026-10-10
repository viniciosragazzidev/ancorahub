import Link from "next/link";
import { notFound } from "next/navigation";

import { DutyNowView } from "@/features/broker-workspace/components/duty-now-view";
import { getDutyNow } from "@/features/broker-workspace/duty-now";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

export const dynamic = "force-dynamic";

/** The broker's plantão happening now (opened from the Plantão conversation). */
export default async function DutyNowPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") notFound();
  const now = new Date();
  const duty = await getDutyNow(now).catch(() => null);

  if (!duty) {
    return (
      <div className="arc-venancor" style={{ minHeight: "100%", background: "var(--surface)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 16px", textAlign: "center", display: "grid", gap: 12 }}>
          <p style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 500 }}>Você não está de plantão agora.</p>
          <Link href="/dashboard/c/plantao" style={{ color: "var(--chat-action)", fontSize: "var(--text-sm)" }}>Ver o próximo plantão</Link>
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
    />
  );
}
