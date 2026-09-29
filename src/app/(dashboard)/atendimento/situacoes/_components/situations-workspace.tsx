"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Plus } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { Input } from "@/components/ui/input";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { toast } from "@/components/ui/sonner";
import { testPhraseAction } from "@/features/attendance-situations/actions";
import { SITUATION_ACTION_LABEL, type SituationAction } from "@/features/attendance-situations/catalog";
import type { PhraseExplanation } from "@/features/attendance-situations/explain";
import type { SituationRow } from "@/features/attendance-situations/service";
import { SituationDrawer, type SituationTarget } from "./situation-drawer";

type KindFilter = "all" | SituationRow["kind"];

const KIND_BADGE: Record<SituationRow["kind"], { label: string; variant: "info" | "secondary" | "outline" }> = {
  builtin: { label: "Do sistema", variant: "outline" },
  custom: { label: "Da empresa", variant: "info" },
  guided: { label: "Orientação para a IA", variant: "secondary" },
};

function actionLabel(row: SituationRow) {
  return row.action === "guide" ? "IA responde com base no roteiro" : SITUATION_ACTION_LABEL[row.action as SituationAction];
}

const columns: ColumnDef<SituationRow>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Situação" />,
    cell: ({ row }) => (
      <span className="grid min-w-0 max-w-md gap-0.5">
        <span className="truncate text-sm font-medium">{row.original.title}</span>
        <span className="truncate text-xs text-muted-foreground">{row.original.response || "Sem resposta"}</span>
      </span>
    ),
  },
  {
    id: "kind",
    accessorFn: (row) => KIND_BADGE[row.kind].label,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => <Badge variant={KIND_BADGE[row.original.kind].variant}>{KIND_BADGE[row.original.kind].label}</Badge>,
  },
  {
    id: "phrases",
    header: "Reconhece por",
    cell: ({ row }) => {
      const examples = [...row.original.phrases, ...row.original.recognizedBy];
      const taught = row.original.kind === "builtin" && row.original.phrases.length ? ` · +${row.original.phrases.length} ensinadas` : "";
      return <span className="block max-w-56 truncate text-xs text-muted-foreground">{row.original.kind === "guided" ? "Quando nenhuma situação cobre a pergunta" : `${examples.slice(0, 2).join(", ")}${taught}`}</span>;
    },
  },
  {
    id: "action",
    header: "O que acontece",
    cell: ({ row }) => <span className="text-xs">{actionLabel(row.original)}</span>,
  },
  {
    id: "channel",
    header: "Canal",
    cell: () => <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">Mesmo canal da conversa</span>,
  },
  {
    id: "enabled",
    accessorFn: (row) => (row.enabled ? 1 : 0),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.critical ? "Sempre ligada" : row.original.enabled ? "Ligada" : "Desligada"}</span>,
  },
];

const RESULT_TITLE: Record<PhraseExplanation["kind"], string> = {
  builtin: "Situação do sistema",
  custom: "Situação da empresa",
  ai: "Gerada pela IA",
  none: "Sem situação",
};

/** "Teste uma frase": the same recognition as the real conversation; nothing is sent. */
function PhraseTester() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PhraseExplanation | null>(null);
  const [pending, startTransition] = useTransition();
  const run = () => startTransition(async () => {
    const response = await testPhraseAction(text);
    if (!response.success) { toast.error(response.error); return; }
    setResult(response.result);
  });
  return (
    <div className="grid gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Teste uma frase</p>
      <p className="text-xs leading-5 text-muted-foreground">Escreva o que um cliente diria no meio da qualificação e veja qual situação dispara, a resposta e o que acontece. Nada é enviado.</p>
      <div className="flex gap-2">
        <Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Ex.: vocês atendem em Niterói?" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); run(); } }} />
        <Button type="button" variant="outline" disabled={pending || !text.trim()} onClick={run}>{pending ? "Testando…" : "Testar"}</Button>
      </div>
      {result ? (
        <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.kind === "ai" ? "secondary" : result.kind === "none" ? "outline" : "info"}>{RESULT_TITLE[result.kind]}</Badge>
            <span className="text-sm font-medium">{result.label}</span>
          </div>
          {result.response ? <p className="whitespace-pre-wrap text-sm leading-6">{result.response}</p> : null}
          <p className="text-xs text-muted-foreground">{result.action}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Atendimento → Situações: one table for every "when the customer says X".
 * A row opens its drawer; "Nova situação" is the screen's single primary action.
 */
export function SituationsWorkspace({ situations }: { situations: SituationRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<KindFilter>("all");
  const [target, setTarget] = useState<SituationTarget>(null);
  const counts = useMemo(() => ({
    all: situations.length,
    builtin: situations.filter((row) => row.kind === "builtin").length,
    custom: situations.filter((row) => row.kind === "custom").length,
    guided: situations.filter((row) => row.kind === "guided").length,
  }), [situations]);
  const rows = filter === "all" ? situations : situations.filter((row) => row.kind === filter);
  const current = target?.mode === "view" ? situations.find((row) => row.id === target.situation.id) : null;
  const drawerTarget: SituationTarget = target?.mode === "view" ? (current ? { mode: "view", situation: current } : null) : target;

  return (
    <Card variant="overview">
      <SectionCardHeader
        title="Situações"
        badge={<Badge variant="secondary">{situations.length} situações</Badge>}
        description="O que acontece quando o cliente diz algo fora da pergunta: respostas prontas (do sistema e da empresa) e os roteiros que orientam a IA quando nenhuma situação cobre."
        actions={<Button size="sm" onClick={() => setTarget({ mode: "new" })}><Plus className="size-3.5" /> Nova situação</Button>}
      />
      <div className="grid gap-3 p-4">
        <PhraseTester />
        <DsSegmentedControl<KindFilter>
          aria-label="Filtrar por tipo"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: `Todas (${counts.all})` },
            { value: "builtin", label: `Do sistema (${counts.builtin})` },
            { value: "custom", label: `Da empresa (${counts.custom})` },
            { value: "guided", label: `Roteiros da IA (${counts.guided})` },
          ]}
          className="max-w-full overflow-x-auto"
        />
        <DataTable columns={columns} data={rows} searchKey="title" searchPlaceholder="Buscar situação" pageSize={15} onRowClick={(row) => setTarget({ mode: "view", situation: row })} />
      </div>
      <SituationDrawer target={drawerTarget} onClose={() => setTarget(null)} onDone={() => router.refresh()} />
    </Card>
  );
}
