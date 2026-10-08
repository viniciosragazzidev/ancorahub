"use client";

import { Warning } from "@/components/huge-icons";

import { formatDateTime } from "./format";
import type { LightLeadDetailData } from "./types";

/** Banner shown when the lead was taken from another broker and given to this one. */
export function LeadNotices({ lead }: { lead: LightLeadDetailData }) {
  if (!lead.redistributionNotice) return null;
  return (
    <section aria-label="Aviso de redistribuição" className="arc-venancor rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <div className="flex items-start gap-3">
        <Warning className="mt-0.5 size-5 shrink-0 text-(--warning)" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-(--foreground)">Lead redistribuído</p>
          <p className="mt-1 text-sm text-(--text-secondary)">
            Este lead foi redistribuído para outro corretor{lead.redistributionNotice.reason ? `: ${lead.redistributionNotice.reason}` : "."}
          </p>
          <time className="mt-2 block text-xs tabular-nums text-(--text-muted)" dateTime={String(lead.redistributionNotice.createdAt)}>
            {formatDateTime(lead.redistributionNotice.createdAt)}
          </time>
        </div>
      </div>
    </section>
  );
}
