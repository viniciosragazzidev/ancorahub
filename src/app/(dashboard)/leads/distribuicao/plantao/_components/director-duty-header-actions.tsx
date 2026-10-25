"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/arc/button/button";

export function DirectorDutyHeaderActions({ scheduleId, canExport, reportDate }: { scheduleId: string; canExport: boolean; reportDate?: string | null }) {
  const router = useRouter();
  const suffix = reportDate ? `?data=${encodeURIComponent(reportDate)}` : "";
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {canExport ? <Button variant="secondary" onClick={() => window.location.assign(`/api/reports/duty-schedule/${scheduleId}${suffix}`)}><Download aria-hidden="true" className="size-4" /> Relatório</Button> : null}
      {canExport && !reportDate ? <Button variant="secondary" onClick={() => window.location.assign(`/api/reports/duty-schedule/${scheduleId}?format=xlsx`)}><FileSpreadsheet aria-hidden="true" className="size-4" /> Planilha</Button> : null}
      <Button variant="ghost" onClick={() => router.push("/distribuicao?view=plantao")}><ArrowLeft aria-hidden="true" className="size-4" /> Plantões</Button>
    </div>
  );
}
