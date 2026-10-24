"use client";

import type { QualificationFunnel } from "@/features/qualification-turbo/funnel";
import { QualificationFunnelView } from "@/features/dashboard/components/director-lite/qualification-funnel-view";

export function FunnelTab({ data, unitName }: { data: QualificationFunnel; unitName: string | null }) {
  return <QualificationFunnelView data={data} unitName={unitName} />;
}
