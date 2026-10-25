"use client";

import { Badge } from "@/components/arc/badge/badge";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { formatLiteDate } from "@/components/lite/format/date";

type Distribution = {
  id: string;
  leadName: string;
  brokerName: string;
  assignedAt: string;
  kind: string;
  exact: boolean;
};

export function DirectorDutyHistoryDistributions({ rows }: { rows: Distribution[] }) {
  const columns: LiteColumn<Distribution>[] = [
    { id: "lead", label: "Lead", primary: true, render: (row) => row.leadName },
    { id: "broker", label: "Corretor", secondary: true, nowrap: true, render: (row) => row.brokerName },
    { id: "assigned", label: "Distribuído em", render: (row) => formatLiteDate(row.assignedAt, { dateStyle: "short", timeStyle: "short" }) },
    { id: "kind", label: "Origem", render: (row) => <Badge>{row.kind}</Badge> },
    { id: "exact", label: "Vínculo", render: (row) => <Badge tone={row.exact ? "success" : "neutral"}>{row.exact ? "Confirmado" : "Estimado pela fila"}</Badge> },
  ];

  return (
    <LiteResponsiveData
      caption="Distribuições do plantão"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      empty={<p>Nenhuma atribuição registrada neste período.</p>}
    />
  );
}
