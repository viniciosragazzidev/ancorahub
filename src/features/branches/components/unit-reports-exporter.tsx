"use client";

import { useState } from "react";
import { FileArrowDown, Loader2Icon } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { reportRegistry, type ReportFormat } from "@/features/reports/report-registry";
import { toast } from "@/components/ui/sonner";
import type { TenantRole } from "@/shared/db/schema";

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

type UnitReportsExporterProps = {
  branchId: string;
  branchName: string;
  currentRole: TenantRole;
};

export function UnitReportsExporter({ branchId, branchName, currentRole }: UnitReportsExporterProps) {
  const [open, setOpen] = useState(false);
  const [reportId, setReportId] = useState("leads");
  const [format, setFormat] = useState<ReportFormat>("xlsx");
  const [preset, setPreset] = useState<RangePreset>("30");
  const [start, setStart] = useState(() => rangeFor(30).start);
  const [end, setEnd] = useState(() => rangeFor(30).end);
  const [isGenerating, setIsGenerating] = useState(false);

  const canExport = currentRole === "director" || currentRole === "manager";
  if (!canExport) return null;

  function changePreset(value: RangePreset) {
    setPreset(value);
    if (value === "custom") return;
    const next = rangeFor(Number(value));
    setStart(next.start);
    setEnd(next.end);
  }

  async function generate() {
    if (!start || !end) return;
    if (start > end) {
      toast.error("A data inicial precisa ser anterior à data final.");
      return;
    }
    setIsGenerating(true);
    try {
      const query = new URLSearchParams({
        start: `${start}T00:00:00.000Z`,
        end: `${end}T23:59:59.999Z`,
        format,
        branchId,
      });
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
      setIsGenerating(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 font-semibold text-xs"
      >
        <FileArrowDown className="size-4" />
        Exportar Relatório da Unidade
      </Button>

      <Dialog open={open} onOpenChange={(val) => !val && !isGenerating && setOpen(false)}>
        <DialogPopup>
          <DialogPanel>
            <DialogHeader>
              <DialogTitle>Exportar Relatório da Unidade: {branchName}</DialogTitle>
              <DialogDescription>
                Selecione o tipo de relatório e o período desejado. Os dados serão filtrados exclusivamente para esta unidade.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4" aria-busy={isGenerating}>
              <label className="grid gap-1.5 text-sm font-medium">
                Tipo de Relatório
                <select
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  disabled={isGenerating}
                  className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm outline-none transition-colors duration-[var(--duration-quick)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 motion-reduce:transition-none"
                >
                  {reportRegistry.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.category})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Período
                <select
                  value={preset}
                  onChange={(e) => changePreset(e.target.value as RangePreset)}
                  disabled={isGenerating}
                  className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm outline-none transition-colors duration-[var(--duration-quick)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 motion-reduce:transition-none"
                >
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Data inicial
                  <Input
                    type="date"
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      setPreset("custom");
                    }}
                    disabled={isGenerating}
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Data final
                  <Input
                    type="date"
                    value={end}
                    onChange={(e) => {
                      setEnd(e.target.value);
                      setPreset("custom");
                    }}
                    disabled={isGenerating}
                  />
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                Formato
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ReportFormat)}
                  disabled={isGenerating}
                  className="h-9 rounded-[10px] border border-input bg-card px-3 text-sm outline-none transition-colors duration-[var(--duration-quick)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 motion-reduce:transition-none"
                >
                  <option value="xlsx">XLSX (Planilha Excel)</option>
                  <option value="csv">CSV (Valores separados por ponto-e-vírgula)</option>
                </select>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isGenerating}>
                Cancelar
              </Button>
              <Button onClick={generate} disabled={isGenerating}>
                {isGenerating ? <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" /> : <FileArrowDown className="size-4" />}
                {isGenerating ? "Gerando..." : "Gerar e Baixar"}
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
