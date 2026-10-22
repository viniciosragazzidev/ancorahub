"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState, useTransition } from "react";

import { ArrowSquareOut, ArrowsClockwise } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetSection, SheetSectionHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";

import { loadSourceFactsAction, reprocessMaterialAction } from "../actions";
import type { FactRow, MaterialRow } from "../queries";
import { areaLabel, documentTypeLabel, fieldLabel, formatDate, materialStatus, qualifiersText, type AreaInfo } from "./labels";

const columns: ColumnDef<MaterialRow>[] = [
  {
    accessorKey: "fileName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Arquivo" />,
    cell: ({ row }) => (
      <span className="grid min-w-0 max-w-sm gap-0.5">
        <span className="truncate text-sm font-medium">{row.original.summary.title || row.original.fileName}</span>
        <span className="truncate text-xs text-muted-foreground">{row.original.fileName}</span>
      </span>
    ),
  },
  {
    id: "carrier",
    accessorFn: (row) => row.carrierName ?? row.summary.carrierName ?? "",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Operadora" />,
    cell: ({ row }) => <span className="text-sm">{row.original.carrierName ?? row.original.summary.carrierName ?? <span className="text-muted-foreground">Não identificada</span>}</span>,
  },
  {
    id: "type",
    accessorFn: (row) => documentTypeLabel(row.documentType),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => <span className="text-xs">{documentTypeLabel(row.original.documentType)}</span>,
  },
  {
    id: "status",
    accessorFn: (row) => materialStatus(row.status).label,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <Badge variant={materialStatus(row.original.status).variant}>{materialStatus(row.original.status).label}</Badge>,
  },
  {
    id: "facts",
    accessorFn: (row) => row.summary.facts ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Informações" />,
    cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.summary.facts ?? "-"}</span>,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Recebido" />,
    cell: ({ row }) => (
      <span className="grid gap-0.5 text-xs">
        <span>{formatDate(row.original.createdAt)}</span>
        <span className="text-muted-foreground">{row.original.origin === "whatsapp" ? "Grupo de WhatsApp" : "Importação"}</span>
      </span>
    ),
  },
];

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="grid gap-0.5 rounded-[var(--radius-card)] border border-border p-3">
      <span className="font-mono text-lg tabular-nums text-foreground">{value ?? 0}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

const FACT_STATUS: Record<string, string> = { current: "No catálogo", pending_review: "Aguardando revisão", superseded: "Substituída", rejected: "Descartada" };

function MaterialDrawer({ material, areas, carriers, onClose }: { material: MaterialRow | null; areas: AreaInfo[]; carriers: Array<{ id: string; name: string }>; onClose: () => void }) {
  return (
    <Sheet open={Boolean(material)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,48rem)]">
        {/* Keyed by file: switching rows starts the drawer state over. */}
        {material ? <MaterialDrawerContent key={material.id} material={material} areas={areas} carriers={carriers} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function MaterialDrawerContent({ material, areas, carriers }: { material: MaterialRow; areas: AreaInfo[]; carriers: Array<{ id: string; name: string }> }) {
  const [facts, setFacts] = useState<Array<FactRow & { status: string }> | null>(null);
  const [carrierId, setCarrierId] = useState<string>(material.carrierId ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    loadSourceFactsAction(material.id).then((rows) => { if (active) setFacts(rows); }).catch(() => { if (active) setFacts([]); });
    return () => { active = false; };
  }, [material.id]);

  const byArea = useMemo(() => {
    const groups = new Map<string, Array<FactRow & { status: string }>>();
    for (const fact of facts ?? []) groups.set(fact.areaSlug, [...(groups.get(fact.areaSlug) ?? []), fact]);
    return [...groups.entries()];
  }, [facts]);

  const reprocess = () => startTransition(async () => {
    const result = await reprocessMaterialAction(material.id, carrierId || null);
    if (result.success) toast.success(result.message);
    else toast.error(result.error);
  });

  const summary = material.summary;
  return (
    <>
        <SheetHeader>
          <SheetTitle>{summary.title || material.fileName}</SheetTitle>
          <SheetDescription>
            {`${documentTypeLabel(material.documentType)} · ${material.carrierName ?? summary.carrierName ?? "Operadora não identificada"} · ${materialStatus(material.status).label}`}
          </SheetDescription>
        </SheetHeader>
        <SheetBody contentClassName="grid gap-4">
          {summary.reason ? <p className="rounded-[var(--radius-card)] border border-border bg-muted/30 p-3 text-sm">{summary.reason}</p> : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Novas" value={summary.added} />
            <Stat label="Atualizadas" value={summary.updated} />
            <Stat label="Iguais ao catálogo" value={summary.unchanged} />
            <Stat label="Aguardando revisão" value={summary.pendingReview} />
          </div>
          {summary.retired || summary.missingForReview || summary.replacedVersions ? (
            <p className="text-xs leading-5 text-muted-foreground">
              Substituiu {summary.replacedVersions ?? 0} versão(ões) anterior(es) deste material. {summary.retired ?? 0} informação(ões) que saíram foram retiradas
              {summary.missingForReview ? ` e ${summary.missingForReview} de preço ou plano esperam sua decisão na Revisão` : ""}.
            </p>
          ) : null}
          {summary.truncated ? <p className="text-xs text-muted-foreground">Material longo: só as primeiras partes foram catalogadas.</p> : null}

          <SheetSection>
            <SheetSectionHeader>
              <div className="min-w-0">
                <p className="text-sm font-medium">Catalogar de novo</p>
                <p className="text-xs leading-5 text-muted-foreground">Escolha a operadora quando a leitura não identificou ou errou. Só o que mudou é atualizado.</p>
              </div>
            </SheetSectionHeader>
            <div className="flex flex-wrap items-center gap-2 p-4">
              <Select value={carrierId} onValueChange={(value) => setCarrierId(String(value ?? ""))}>
                <SelectTrigger aria-label="Operadora" className="w-56"><SelectValue placeholder="Operadora identificada pela IA" /></SelectTrigger>
                <SelectContent>
                  {carriers.map((carrier) => <SelectItem key={carrier.id} value={carrier.id}>{carrier.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" disabled={pending} onClick={reprocess}>
                <ArrowsClockwise className="size-3.5" /> Reprocessar
              </Button>
              {material.hasOriginal ? (
                <Button size="sm" variant="ghost" render={<a href={`/api/operator-materials/${material.id}/file`} target="_blank" rel="noreferrer" />}>
                  <ArrowSquareOut className="size-3.5" /> Abrir original
                </Button>
              ) : null}
            </div>
          </SheetSection>

          {facts === null ? <p className="text-sm text-muted-foreground">Carregando informações...</p> : null}
          {facts?.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma informação catalogada deste arquivo ainda.</p> : null}
          {byArea.map(([slug, rows]) => (
            <SheetSection key={slug}>
              <SheetSectionHeader>
                <p className="text-sm font-medium">{areaLabel(areas, slug)}</p>
                <span className="font-mono text-xs text-muted-foreground">{rows.length}</span>
              </SheetSectionHeader>
              <ul className="grid divide-y divide-border">
                {rows.slice(0, 200).map((fact) => (
                  <li key={fact.id} className="grid gap-0.5 px-4 py-2 text-sm">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{fieldLabel(areas, fact.areaSlug, fact.fieldKey)}{fact.planName ? <span className="font-normal text-muted-foreground"> · {fact.planName}</span> : null}</span>
                      <span className="text-xs text-muted-foreground">{FACT_STATUS[fact.status] ?? fact.status}</span>
                    </span>
                    <span>{fact.valueText}{fact.unit && !fact.valueText.includes(fact.unit) && fact.unit !== "BRL" ? ` ${fact.unit}` : ""}</span>
                    {Object.keys(fact.qualifiers).length ? <span className="text-xs text-muted-foreground">{qualifiersText(fact.qualifiers)}</span> : null}
                  </li>
                ))}
              </ul>
            </SheetSection>
          ))}
        </SheetBody>
    </>
  );
}

export function MaterialsPanel({ materials, areas, carriers }: { materials: MaterialRow[]; areas: AreaInfo[]; carriers: Array<{ id: string; name: string }> }) {
  const [selected, setSelected] = useState<MaterialRow | null>(null);
  // After a refresh the open drawer follows the fresh row.
  const current = selected ? materials.find((material) => material.id === selected.id) ?? null : null;
  return (
    <>
      <DataTable columns={columns} data={materials} searchKey="fileName" searchPlaceholder="Buscar arquivo" pageSize={15} onRowClick={setSelected} />
      <MaterialDrawer material={current} areas={areas} carriers={carriers} onClose={() => setSelected(null)} />
    </>
  );
}
