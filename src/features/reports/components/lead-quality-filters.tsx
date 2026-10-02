"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Download, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AppSelect } from "@/components/ui/select";
import { LEAD_ORIGINS } from "../metrics/lead-quality-contract";
import type { LeadQualityPeriod } from "../metrics/lead-quality-period";

type Queue = { id: string; name: string };

const ALL = "all";
const triggerClassName = "h-8 rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-muted";

/** Queue filter of the quality center, persisted as `?queue=<id>` (drill-down cleared). */
export function QualityQueueSelect({ queues, value }: { queues: Queue[]; value: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <AppSelect
      aria-label="Fila da análise de qualidade"
      className="w-40 shrink-0 max-[719px]:hidden"
      triggerClassName={triggerClassName}
      disabled={isPending}
      value={value ?? ALL}
      options={[{ value: ALL, label: "Todas as filas" }, ...queues.map((queue) => ({ value: queue.id, label: queue.name }))]}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === ALL) params.delete("queue");
        else params.set("queue", next);
        params.delete("dimension");
        params.delete("key");
        startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
      }}
    />
  );
}

const PERIODS: { value: string; label: string }[] = [
  { value: "today", label: "Hoje (18h–18h)" },
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
];

/**
 * "Exportar relatório ▾": period, queue and origin of the report, then the
 * PDF or the spreadsheet. Starts from what is on screen.
 */
export function LeadQualityExportMenu({ queues, period, queueId }: { queues: Queue[]; period: LeadQualityPeriod; queueId: string | null }) {
  const [open, setOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(String(period));
  const [selectedQueue, setSelectedQueue] = useState(queueId ?? ALL);
  const [selectedOrigin, setSelectedOrigin] = useState(ALL);

  const href = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams({ period: selectedPeriod, format });
    if (selectedQueue !== ALL) params.set("queue", selectedQueue);
    if (selectedOrigin !== ALL) params.set("origin", selectedOrigin);
    return `/api/reports/lead-quality?${params.toString()}`;
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelectedPeriod(String(period));
          setSelectedQueue(queueId ?? ALL);
        }
      }}
    >
      <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Download className="size-3.5" aria-hidden="true" /><span className="max-[1279px]:hidden">Exportar relatório</span><span className="min-[1280px]:hidden">Exportar</span><ChevronDown className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-semibold">Relatório de qualidade</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Mesmos números da página, separados por origem e por turno (18h–13h30 e 13h30–18h).</p>
        </div>
        <label className="block space-y-1 text-xs font-medium text-muted-foreground">
          Período
          <AppSelect aria-label="Período do relatório" value={selectedPeriod} onValueChange={setSelectedPeriod} options={PERIODS} />
        </label>
        <label className="block space-y-1 text-xs font-medium text-muted-foreground">
          Fila
          <AppSelect
            aria-label="Fila do relatório"
            value={selectedQueue}
            onValueChange={setSelectedQueue}
            options={[{ value: ALL, label: "Todas as filas" }, ...queues.map((queue) => ({ value: queue.id, label: queue.name }))]}
          />
        </label>
        <label className="block space-y-1 text-xs font-medium text-muted-foreground">
          Origem
          <AppSelect
            aria-label="Origem do relatório"
            value={selectedOrigin}
            onValueChange={setSelectedOrigin}
            options={[{ value: ALL, label: "Todas (Formulário, WhatsApp e Outros)" }, ...LEAD_ORIGINS.map((origin) => ({ value: origin.key, label: origin.label }))]}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button size="sm" variant="outline" className="gap-1.5" render={<a href={href("pdf")} download onClick={() => setOpen(false)} />}>
            <Download className="size-3.5" aria-hidden="true" /> Baixar PDF
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" render={<a href={href("xlsx")} download onClick={() => setOpen(false)} />}>
            <FileSpreadsheet className="size-3.5" aria-hidden="true" /> Planilha
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
