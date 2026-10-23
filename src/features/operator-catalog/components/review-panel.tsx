"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState, useTransition } from "react";

import { Check, MoreHorizontalIcon, X } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";

import { approveEverythingAction, approveFactsAction, approvePlanAction, rejectFactsAction, rejectPlanAction, resolveMissingFactsAction, reviewSuggestionAction } from "../actions";
import type { FactRow, ReviewQueue } from "../queries";
import { areaLabel, fieldLabel, qualifiersText, validityText, type AreaInfo } from "./labels";

type View = "facts" | "plans" | "missing" | "suggestions" | "divergences";
type Run = (task: () => Promise<{ success: true; message: string } | { success: false; error: string }>) => void;

function RowMenu({ items }: { items: Array<{ label: string; onClick: () => void; destructive?: boolean }> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Ações" onClick={(event) => event.stopPropagation()} />}>
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} variant={item.destructive ? "destructive" : undefined} onClick={item.onClick}>{item.label}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function factColumns(areas: AreaInfo[], extra: { previousTitle: string; actions: (fact: FactRow) => Array<{ label: string; onClick: () => void; destructive?: boolean }> }): ColumnDef<FactRow>[] {
  return [
    {
      id: "what",
      accessorFn: (fact) => `${fact.carrierName} ${fact.planName ?? ""} ${fieldLabel(areas, fact.areaSlug, fact.fieldKey)}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Informação" />,
      cell: ({ row }) => (
        <span className="grid min-w-0 max-w-sm gap-0.5">
          <span className="truncate text-sm font-medium">{areaLabel(areas, row.original.areaSlug)} · {fieldLabel(areas, row.original.areaSlug, row.original.fieldKey)}</span>
          <span className="truncate text-xs text-muted-foreground">{row.original.carrierName}{row.original.planName ? ` · ${row.original.planName}` : ""}</span>
          {Object.keys(row.original.qualifiers).length ? <span className="truncate text-xs text-muted-foreground">{qualifiersText(row.original.qualifiers)}</span> : null}
        </span>
      ),
    },
    {
      accessorKey: "valueText",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Valor" />,
      cell: ({ row }) => <span className="block max-w-xs whitespace-pre-wrap break-words text-sm">{row.original.valueText}</span>,
    },
    {
      id: "previous",
      accessorFn: (fact) => fact.previousValue ?? "",
      header: extra.previousTitle,
      cell: ({ row }) => <span className="block max-w-xs whitespace-pre-wrap break-words text-sm text-muted-foreground">{row.original.previousValue ?? "Novo"}</span>,
    },
    {
      id: "source",
      accessorFn: (fact) => fact.sourceName ?? "",
      header: "Fonte",
      cell: ({ row }) => (
        <span className="grid max-w-[14rem] gap-0.5 text-xs">
          <span className="truncate">{row.original.sourceName ?? "-"}{row.original.page ? ` · pág. ${row.original.page}` : ""}</span>
          <span className="text-muted-foreground">{validityText(row.original.validFrom, row.original.validUntil)}</span>
        </span>
      ),
    },
    { id: "actions", header: "", cell: ({ row }) => <RowMenu items={extra.actions(row.original)} /> },
  ];
}

export function ReviewPanel({ queue, areas }: { queue: ReviewQueue; areas: AreaInfo[] }) {
  const [view, setView] = useState<View>(queue.pendingFacts.length ? "facts" : queue.draftPlans.length ? "plans" : queue.missingFacts.length ? "missing" : queue.suggestions.length ? "suggestions" : "facts");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [pending, startTransition] = useTransition();

  const run: Run = (task) => startTransition(async () => {
    const result = await task();
    if (result.success) toast.success(result.message);
    else toast.error(result.error);
  });

  const sources = useMemo(() => {
    const names = new Map<string, string>();
    for (const fact of queue.pendingFacts) if (fact.sourceId) names.set(fact.sourceId, fact.sourceName ?? "Material");
    return [...names.entries()];
  }, [queue.pendingFacts]);
  const visibleFacts = sourceFilter === "all" ? queue.pendingFacts : queue.pendingFacts.filter((fact) => fact.sourceId === sourceFilter);

  const pendingColumns = useMemo(() => factColumns(areas, {
    previousTitle: "Hoje no catálogo",
    actions: (fact) => [
      { label: "Aprovar", onClick: () => run(() => approveFactsAction([fact.id])) },
      { label: "Descartar", destructive: true, onClick: () => run(() => rejectFactsAction([fact.id])) },
    ],
  }), [areas]);
  const missingColumns = useMemo(() => factColumns(areas, {
    previousTitle: "Situação",
    actions: (fact) => [
      { label: "Retirar do catálogo", destructive: true, onClick: () => run(() => resolveMissingFactsAction([fact.id], "remove")) },
      { label: "Manter", onClick: () => run(() => resolveMissingFactsAction([fact.id], "keep")) },
    ],
  }), [areas]);
  const divergenceColumns = useMemo(() => factColumns(areas, { previousTitle: "Tabela oficial", actions: () => [] }).filter((column) => column.id !== "actions"), [areas]);

  const planColumns: ColumnDef<ReviewQueue["draftPlans"][number]>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Plano" />,
      cell: ({ row }) => (
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.carrierName}</span>
        </span>
      ),
    },
    { accessorKey: "pendingFacts", header: "Informações", cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.pendingFacts}</span> },
    { accessorKey: "sourceName", header: "Encontrado em", cell: ({ row }) => <span className="block max-w-xs truncate text-xs">{row.original.sourceName ?? "-"}</span> },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <RowMenu items={[
          { label: "Aprovar plano e informações", onClick: () => run(() => approvePlanAction(row.original.id)) },
          { label: "Descartar plano", destructive: true, onClick: () => run(() => rejectPlanAction(row.original.id)) },
        ]} />
      ),
    },
  ];

  const suggestionColumns: ColumnDef<ReviewQueue["suggestions"][number]>[] = [
    {
      accessorKey: "label",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Sugestão" />,
      cell: ({ row }) => (
        <span className="grid max-w-md gap-0.5">
          <span className="text-sm font-medium">{row.original.kind === "area" ? "Área nova" : `Campo novo em ${areaLabel(areas, row.original.areaSlug)}`}: {row.original.label}</span>
          {row.original.description ? <span className="text-xs text-muted-foreground">{row.original.description}</span> : null}
        </span>
      ),
    },
    { accessorKey: "example", header: "Exemplo do material", cell: ({ row }) => <span className="block max-w-xs truncate text-xs">{row.original.example ?? "-"}</span> },
    { accessorKey: "occurrences", header: "Vezes", cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.occurrences}</span> },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <RowMenu items={[
          { label: "Incluir no catálogo", onClick: () => run(() => reviewSuggestionAction(row.original.id, "approve")) },
          { label: "Descartar", destructive: true, onClick: () => run(() => reviewSuggestionAction(row.original.id, "reject")) },
        ]} />
      ),
    },
  ];

  const empty = <p className="p-6 text-center text-sm text-muted-foreground">Nada esperando por aqui.</p>;

  const waiting = queue.pendingFacts.length + queue.draftPlans.length + queue.suggestions.length;

  return (
    <div className="grid gap-3">
      {waiting ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-5 text-muted-foreground">Aprova os planos novos, os preços e regras e as áreas e campos de uma vez. Pode levar alguns minutos.</p>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Aprovar tudo o que está em revisão (${queue.draftPlans.length} plano(s), ${queue.pendingFacts.length} informação(ões) e ${queue.suggestions.length} área(s) ou campo(s))?`)) run(approveEverythingAction);
            }}
          >
            <Check className="size-3.5" /> Aprovar tudo
          </Button>
        </div>
      ) : null}
      <DsSegmentedControl<View>
        aria-label="O que revisar"
        value={view}
        onValueChange={setView}
        options={[
          { value: "facts", label: `Preços e regras (${queue.pendingFacts.length})` },
          { value: "plans", label: `Planos novos (${queue.draftPlans.length})` },
          { value: "missing", label: `Saíram da versão nova (${queue.missingFacts.length})` },
          { value: "suggestions", label: `Áreas e campos (${queue.suggestions.length})` },
          { value: "divergences", label: `Cotação diferente da tabela (${queue.divergences.length})` },
        ]}
        className="max-w-full overflow-x-auto"
      />

      {view === "facts" ? (
        <>
          <p className="text-xs leading-5 text-muted-foreground">Preços, planos, promoções e comissão só entram no catálogo com sua aprovação. O valor de hoje continua valendo até lá.</p>
          <DataTable
            columns={pendingColumns}
            data={visibleFacts}
            pageSize={20}
            emptyState={empty}
            headerSlot={
              <div className="flex flex-wrap items-center gap-2">
                <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(String(value ?? "all"))}>
                  <SelectTrigger aria-label="Material" className="w-64"><SelectValue placeholder="Todos os materiais">{sourceFilter === "all" ? "Todos os materiais" : sources.find(([id]) => id === sourceFilter)?.[1]}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os materiais</SelectItem>
                    {sources.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" disabled={pending || !visibleFacts.length} onClick={() => run(() => approveFactsAction(visibleFacts.map((fact) => fact.id)))}>
                  <Check className="size-3.5" /> Aprovar {visibleFacts.length}
                </Button>
                <Button size="sm" variant="ghost" disabled={pending || !visibleFacts.length} onClick={() => run(() => rejectFactsAction(visibleFacts.map((fact) => fact.id)))}>
                  <X className="size-3.5" /> Descartar
                </Button>
              </div>
            }
          />
        </>
      ) : null}

      {view === "plans" ? (
        <>
          <p className="text-xs leading-5 text-muted-foreground">Planos que apareceram num material e ainda não existem no catálogo. Ao aprovar, o plano fica disponível e as informações dele entram juntas.</p>
          <DataTable columns={planColumns} data={queue.draftPlans} pageSize={20} emptyState={empty} />
        </>
      ) : null}

      {view === "missing" ? (
        <>
          <p className="text-xs leading-5 text-muted-foreground">A versão anterior de um material dizia isto e a nova não diz mais (ex.: plano retirado da tabela). Regras e textos saem sozinhos; preços e planos esperam você.</p>
          <DataTable
            columns={missingColumns.map((column) => (column.id === "previous" ? { ...column, cell: () => <span className="text-xs text-muted-foreground">Não está na versão nova</span> } : column))}
            data={queue.missingFacts}
            pageSize={20}
            emptyState={empty}
            headerSlot={queue.missingFacts.length ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => resolveMissingFactsAction(queue.missingFacts.map((fact) => fact.id), "remove"))}>
                Retirar todos
              </Button>
            ) : undefined}
          />
        </>
      ) : null}

      {view === "suggestions" ? (
        <>
          <p className="text-xs leading-5 text-muted-foreground">Informações que não cabiam nas áreas atuais. Ao incluir, a área ou o campo passa a valer para todas as operadoras.</p>
          <DataTable columns={suggestionColumns} data={queue.suggestions} pageSize={20} emptyState={empty} />
        </>
      ) : null}

      {view === "divergences" ? (
        <>
          <p className="text-xs leading-5 text-muted-foreground">Valores de cotações que não batem com a tabela oficial catalogada. Servem de alerta: a tabela só muda com um material novo da operadora.</p>
          <DataTable columns={divergenceColumns} data={queue.divergences} pageSize={20} emptyState={empty} />
        </>
      ) : null}
    </div>
  );
}
