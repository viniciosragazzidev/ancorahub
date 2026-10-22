"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";

import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { loadCarrierFactsAction } from "../actions";
import type { CarrierOverview, FactRow } from "../queries";
import { areaLabel, fieldLabel, formatDate, qualifiersText, validityText, type AreaInfo } from "./labels";

function carrierColumns(areas: AreaInfo[]): ColumnDef<CarrierOverview>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Operadora" />,
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "activePlans",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Planos" />,
      cell: ({ row }) => (
        <span className="text-xs">
          <span className="font-mono tabular-nums">{row.original.activePlans}</span>
          {row.original.draftPlans ? <span className="text-muted-foreground"> · {row.original.draftPlans} aguardando</span> : null}
        </span>
      ),
    },
    {
      accessorKey: "facts",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Informações" />,
      cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.facts}</span>,
    },
    {
      id: "areas",
      header: "Áreas preenchidas",
      cell: ({ row }) => (
        <span className="flex max-w-md flex-wrap gap-1">
          {row.original.areas.map((area) => (
            <span key={area.slug} className="rounded-full border border-border px-2 py-0.5 text-[11px]">{areaLabel(areas, area.slug)} {area.facts}</span>
          ))}
        </span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Última confirmação" />,
      cell: ({ row }) => <span className="text-xs">{row.original.updatedAt ? formatDate(row.original.updatedAt) : "-"}</span>,
    },
  ];
}

function factColumns(areas: AreaInfo[]): ColumnDef<FactRow>[] {
  return [
    {
      id: "field",
      accessorFn: (fact) => `${fact.planName ?? ""} ${fieldLabel(areas, fact.areaSlug, fact.fieldKey)} ${fact.valueText}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Informação" />,
      cell: ({ row }) => (
        <span className="grid min-w-0 max-w-xs gap-0.5">
          <span className="truncate text-sm font-medium">{fieldLabel(areas, row.original.areaSlug, row.original.fieldKey)}</span>
          <span className="truncate text-xs text-muted-foreground">{row.original.planName ?? "Toda a operadora"}</span>
        </span>
      ),
    },
    {
      accessorKey: "valueText",
      header: "Valor",
      cell: ({ row }) => (
        <span className="grid max-w-xs gap-0.5">
          <span className="whitespace-pre-wrap break-words text-sm">{row.original.valueText}</span>
          {Object.keys(row.original.qualifiers).length ? <span className="text-xs text-muted-foreground">{qualifiersText(row.original.qualifiers)}</span> : null}
        </span>
      ),
    },
    {
      id: "source",
      header: "Fonte e vigência",
      cell: ({ row }) => (
        <span className="grid max-w-[14rem] gap-0.5 text-xs">
          <span className="truncate">{row.original.origin === "quote" ? "Cotação · " : ""}{row.original.sourceName ?? "-"}{row.original.page ? ` · pág. ${row.original.page}` : ""}</span>
          <span className="text-muted-foreground">{validityText(row.original.validFrom, row.original.validUntil)}</span>
        </span>
      ),
    },
  ];
}

function CarrierDrawer({ carrier, areas, onClose }: { carrier: CarrierOverview | null; areas: AreaInfo[]; onClose: () => void }) {
  return (
    <Sheet open={Boolean(carrier)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,60rem)]">
        {carrier ? <CarrierDrawerContent key={carrier.id} carrier={carrier} areas={areas} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function CarrierDrawerContent({ carrier, areas }: { carrier: CarrierOverview; areas: AreaInfo[] }) {
  const [area, setArea] = useState<string>(carrier.areas[0]?.slug ?? "");
  const [facts, setFacts] = useState<FactRow[] | null>(null);
  const filled = carrier.areas.map((item) => item.slug);

  useEffect(() => {
    if (!area) return;
    let active = true;
    loadCarrierFactsAction(carrier.id, area).then((rows) => { if (active) setFacts(rows); }).catch(() => { if (active) setFacts([]); });
    return () => { active = false; };
  }, [carrier.id, area]);

  const chooseArea = (next: string) => {
    setFacts(null);
    setArea(next);
  };

  return (
    <>
        <SheetHeader>
          <SheetTitle>{carrier.name}</SheetTitle>
          <SheetDescription>O que está valendo hoje no catálogo, por área. Cada informação mostra de qual material veio e a vigência.</SheetDescription>
        </SheetHeader>
        <SheetBody contentClassName="grid gap-3">
          {filled.length ? (
            <DsSegmentedControl<string>
              aria-label="Área"
              value={area}
              onValueChange={chooseArea}
              options={filled.map((slug) => ({ value: slug, label: `${areaLabel(areas, slug)} (${carrier.areas.find((item) => item.slug === slug)?.facts ?? 0})` }))}
              className="max-w-full overflow-x-auto"
            />
          ) : <p className="text-sm text-muted-foreground">Nenhuma informação aprovada desta operadora ainda.</p>}
          {facts === null && filled.length ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {facts ? <DataTable columns={factColumns(areas)} data={facts} searchKey="field" searchPlaceholder="Buscar plano, campo ou valor" pageSize={25} /> : null}
        </SheetBody>
    </>
  );
}

export function CatalogPanel({ carriers, areas }: { carriers: CarrierOverview[]; areas: AreaInfo[] }) {
  const [selected, setSelected] = useState<CarrierOverview | null>(null);
  const current = selected ? carriers.find((carrier) => carrier.id === selected.id) ?? null : null;
  return (
    <>
      <DataTable columns={carrierColumns(areas)} data={carriers} searchKey="name" searchPlaceholder="Buscar operadora" pageSize={15} onRowClick={setSelected} />
      <CarrierDrawer carrier={current} areas={areas} onClose={() => setSelected(null)} />
    </>
  );
}

/** Every area and field of the catalog: the base shared by all operators. */
export function AreasList({ areas }: { areas: AreaInfo[] }) {
  return (
    <ul className="grid gap-3">
      {areas.map((area) => (
        <li key={area.slug} className="grid gap-1 rounded-[var(--radius-card)] border border-border p-3">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {area.label}
            {area.custom ? <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">Criada a partir de material</span> : null}
            {area.reviewRequired ? <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted-foreground">Muda só com aprovação</span> : null}
          </span>
          {area.description ? <span className="text-xs text-muted-foreground">{area.description}</span> : null}
          <span className="text-xs text-muted-foreground">{area.fields.map((field) => field.label).join(" · ") || "Sem campos fixos"}</span>
        </li>
      ))}
    </ul>
  );
}
