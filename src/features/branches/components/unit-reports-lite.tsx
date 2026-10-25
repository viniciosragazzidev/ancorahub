"use client";

/**
 * Exportar relatório da unidade no visual Lite (painel lateral no desktop, folha no celular). Mesmo pedido da tela
 * atual: GET /api/reports/<id> com início, fim, formato e unidade; o arquivo baixa e o painel fecha.
 */
import { useState } from "react";
import { FileDown } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { LITE_TIME_ZONE } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { reportRegistry, type ReportFormat } from "@/features/reports/report-registry";

type RangePreset = "30" | "90" | "custom";

/** Dia (aaaa-mm-dd) no fuso de São Paulo. */
function dayKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LITE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function unitReportRange(days: number, now = new Date()) {
  const start = new Date(now.getTime() - (days - 1) * 86_400_000);
  return { start: dayKey(start), end: dayKey(now) };
}

function downloadName(contentDisposition: string | null, fallback: string) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export function UnitReportsLite({ branchId, branchName }: { branchId: string; branchName: string }) {
  const [open, setOpen] = useState(false);
  const [reportId, setReportId] = useState("leads");
  const [format, setFormat] = useState<ReportFormat>("xlsx");
  const [preset, setPreset] = useState<RangePreset>("30");
  const [range, setRange] = useState(() => unitReportRange(30));
  const [generating, setGenerating] = useState(false);

  const changePreset = (value: string) => {
    setPreset(value as RangePreset);
    if (value !== "custom") setRange(unitReportRange(Number(value)));
  };

  const generate = async () => {
    if (!range.start || !range.end) return;
    if (range.start > range.end) {
      toast.error("A data inicial precisa ser anterior à data final.");
      return;
    }
    setGenerating(true);
    try {
      const query = new URLSearchParams({ start: `${range.start}T00:00:00.000Z`, end: `${range.end}T23:59:59.999Z`, format, branchId });
      const response = await fetch(`/api/reports/${reportId}?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Não foi possível gerar o relatório da unidade.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName(response.headers.get("content-disposition"), `relatorio-unidade-${branchId}.${format}`);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`Relatório de ${branchName} baixado com sucesso!`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar relatório.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <button type="button" className={page.button} onClick={() => setOpen(true)}>
        <FileDown aria-hidden="true" size={16} />Exportar relatório
      </button>
      <LiteSidePanel open={open} onOpenChange={(next) => { if (!next && !generating) setOpen(false); }} title={`Exportar relatório: ${branchName}`} description="Os dados saem filtrados só para esta unidade.">
        <div className={form.form} aria-busy={generating}>
          <LiteSelect label="Tipo de relatório" value={reportId} onChange={setReportId} options={reportRegistry.map((report) => ({ value: report.id, label: `${report.title} (${report.category})` }))} />
          <LiteSelect label="Período" value={preset} onChange={changePreset} options={[{ value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }, { value: "custom", label: "Personalizado" }]} />
          <div className={form.row}>
            <label className={form.field}>
              <span className={form.label}>Data inicial</span>
              <input type="date" className={form.input} value={range.start} disabled={generating} onChange={(event) => { setRange((current) => ({ ...current, start: event.target.value })); setPreset("custom"); }} />
            </label>
            <label className={form.field}>
              <span className={form.label}>Data final</span>
              <input type="date" className={form.input} value={range.end} disabled={generating} onChange={(event) => { setRange((current) => ({ ...current, end: event.target.value })); setPreset("custom"); }} />
            </label>
          </div>
          <LiteSelect label="Formato" value={format} onChange={(value) => setFormat(value as ReportFormat)} options={[{ value: "xlsx", label: "XLSX (planilha Excel)" }, { value: "csv", label: "CSV (separado por ponto e vírgula)" }]} />
          <div className={form.actions}>
            <button type="button" className={page.button} disabled={generating} onClick={() => setOpen(false)}>Cancelar</button>
            <button type="button" className={page.primaryButton} disabled={generating} onClick={generate}>
              <FileDown aria-hidden="true" size={16} />{generating ? "Gerando..." : "Gerar e baixar"}
            </button>
          </div>
        </div>
      </LiteSidePanel>
    </>
  );
}
