"use client";

import { useMemo, useState } from "react";
import { FileArrowDown, Loader2Icon } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ReportDefinition, ReportFormat } from "@/features/reports/report-registry";
import { toast } from "sonner";

type RangePreset = "30" | "90" | "custom";

function localDate(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 10);
}

function rangeFor(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { start: localDate(start), end: localDate(end) };
}

function downloadName(contentDisposition: string | null, fallback: string) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export function ReportCenter({ reports }: { reports: readonly ReportDefinition[] }) {
  const [selected, setSelected] = useState<ReportDefinition | null>(null);
  const [format, setFormat] = useState<ReportFormat>("xlsx");
  const [preset, setPreset] = useState<RangePreset>("30");
  const initialRange = useMemo(() => rangeFor(30), []);
  const [start, setStart] = useState(initialRange.start);
  const [end, setEnd] = useState(initialRange.end);
  const [isGenerating, setIsGenerating] = useState(false);

  function openReport(report: ReportDefinition) {
    setSelected(report);
    setFormat(report.formats[0]);
    setPreset("30");
    const next = rangeFor(30);
    setStart(next.start);
    setEnd(next.end);
  }

  function changePreset(value: RangePreset) {
    setPreset(value);
    if (value === "custom") return;
    const next = rangeFor(Number(value));
    setStart(next.start);
    setEnd(next.end);
  }

  async function generate() {
    if (!selected || !start || !end) return;
    if (start > end) {
      toast.error("A data inicial precisa ser anterior à data final.");
      return;
    }
    setIsGenerating(true);
    try {
      const query = new URLSearchParams({ start: `${start}T00:00:00.000Z`, end: `${end}T23:59:59.999Z`, format });
      const response = await fetch(`/api/reports/${selected.id}?${query.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Não foi possível gerar o relatório.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName(response.headers.get("content-disposition"), `relatorio-${selected.id}.${format}`);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Relatório pronto para download.");
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório.");
    } finally {
      setIsGenerating(false);
    }
  }

  const grouped = reports.reduce<Record<string, ReportDefinition[]>>((groups, report) => {
    groups[report.category] ??= [];
    groups[report.category].push(report);
    return groups;
  }, {});

  return (
    <section aria-labelledby="report-center-title">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="report-center-title" className="text-base font-semibold tracking-tight">Central de relatórios</h2>
          <p className="mt-1 text-sm text-muted-foreground">Escolha o recorte, gere o arquivo e continue a análise fora da plataforma.</p>
        </div>
        <p className="text-xs text-muted-foreground">Exportações registradas para auditoria.</p>
      </div>
      <div className="space-y-5">
        {Object.entries(grouped).map(([category, categoryReports]) => (
          <div key={category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categoryReports.map((report) => {
                const Icon = report.icon;
                return <Card key={report.id} variant="compact" className="min-w-0">
                  <CardHeader className="gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div>
                    <div className="min-w-0"><CardTitle>{report.title}</CardTitle><CardDescription className="mt-1">{report.description}</CardDescription></div>
                  </CardHeader>
                  <CardContent className="flex items-end justify-between gap-3 pt-1">
                    <p className="text-xs leading-5 text-muted-foreground">{report.includes}</p>
                    <Button size="sm" variant="outline" onClick={() => openReport(report)} aria-label={`Gerar relatório de ${report.title}`}><FileArrowDown className="size-4" />Gerar</Button>
                  </CardContent>
                </Card>;
              })}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && !isGenerating && setSelected(null)}>
        <DialogPopup>
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Gerar {selected?.title}</DialogTitle>
              <DialogDescription>{selected?.description} O arquivo contém até 10 mil linhas por vez e períodos de até 366 dias.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4" aria-busy={isGenerating}>
              <label className="grid gap-1.5 text-sm font-medium">Período
                <select value={preset} onChange={(event) => changePreset(event.target.value as RangePreset)} disabled={isGenerating} className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm outline-none transition-colors duration-[var(--duration-quick)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 motion-reduce:transition-none">
                  <option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="custom">Personalizado</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">Data inicial<Input type="date" value={start} onChange={(event) => { setStart(event.target.value); setPreset("custom"); }} disabled={isGenerating} /></label>
                <label className="grid gap-1.5 text-sm font-medium">Data final<Input type="date" value={end} onChange={(event) => { setEnd(event.target.value); setPreset("custom"); }} disabled={isGenerating} /></label>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">Formato
                <select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)} disabled={isGenerating} className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm outline-none transition-colors duration-[var(--duration-quick)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 motion-reduce:transition-none">
                  {selected?.formats.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
                </select>
              </label>
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">O escopo é aplicado no servidor conforme a sua função. Dados financeiros não são incluídos em relatórios de supervisor.</p>
              <p aria-live="polite" className="min-h-5 text-xs text-muted-foreground">{isGenerating ? "Preparando arquivo seguro para download…" : ""}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)} disabled={isGenerating}>Cancelar</Button>
              <Button onClick={generate} disabled={isGenerating || !selected}>{isGenerating ? <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" /> : <FileArrowDown className="size-4" />} {isGenerating ? "Gerando" : "Gerar e baixar"}</Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </section>
  );
}
