"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMessageLibraryAction } from "@/features/ai-qualification/actions";
import type { LibraryMessage } from "@/features/message-library/service";
import { cn } from "@/lib/utils";

const kindVariant: Record<LibraryMessage["kind"], "info" | "secondary" | "outline"> = {
  meta_template: "info",
  free_message: "secondary",
  quick_reply: "outline",
};

function ValidityChips({ message }: { message: LibraryMessage }) {
  return (
    <span className="flex flex-wrap gap-1">
      {message.validity.map((item) => (
        <span
          key={item.channel}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px]",
            item.valid === "always" ? "border-border text-foreground" : item.valid === "window" ? "border-border text-muted-foreground" : "border-dashed border-border text-muted-foreground/70",
          )}
        >
          {item.label}
        </span>
      ))}
    </span>
  );
}

const columns: ColumnDef<LibraryMessage>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Mensagem" />,
    cell: ({ row }) => (
      <span className="grid min-w-0 max-w-md gap-0.5">
        <span className="truncate text-sm font-medium">{row.original.name}</span>
        <span className="truncate text-xs text-muted-foreground">{row.original.text || "Sem texto sincronizado"}</span>
      </span>
    ),
  },
  {
    accessorKey: "kindLabel",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => <Badge variant={kindVariant[row.original.kind]}>{row.original.kindLabel}</Badge>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.status}</span>,
  },
  {
    id: "validity",
    header: "Onde vale",
    cell: ({ row }) => <ValidityChips message={row.original} />,
  },
  {
    id: "usages",
    accessorFn: (message) => message.usages.length,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Em uso" />,
    cell: ({ row }) => row.original.usages.length
      ? <span className="text-xs">{row.original.usages.length === 1 ? row.original.usages[0].label : `${row.original.usages.length} lugares`}</span>
      : <span className="text-xs text-muted-foreground">Não usada</span>,
  },
];

/**
 * Message library (phase 2): every message with its kind, where it is valid
 * and where it is used. Editing stays in the panels below; this is the map.
 */
export function MessageLibraryCard() {
  const [messages, setMessages] = useState<LibraryMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<LibraryMessage | null>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchMessageLibraryAction());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, [load]);

  const inUse = messages?.filter((message) => message.usages.length).length ?? 0;

  return (
    <Card variant="overview">
      <SectionCardHeader
        title="Biblioteca de mensagens"
        badge={messages ? <Badge variant="secondary">{messages.length} mensagens · {inUse} em uso</Badge> : null}
        description="Tudo o que o sistema pode enviar, com o tipo e onde cada uma vale. Template Meta sai a qualquer hora pela Meta; mensagem livre sai pelo WhatsApp da empresa a qualquer hora e pela Meta só nas 24h depois que a pessoa escreveu."
      />
      <div className="p-4">
        {failed ? (
          <p className="text-sm text-muted-foreground">Não foi possível carregar a biblioteca. Recarregue a página.</p>
        ) : !messages ? (
          <div className="grid gap-2" aria-label="Carregando biblioteca"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
        ) : (
          <DataTable columns={columns} data={messages} searchKey="name" searchPlaceholder="Buscar mensagem" pageSize={10} onRowClick={setSelected} />
        )}
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent>
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>{selected.kindLabel} · {selected.status}{selected.category ? ` · ${selected.category}` : ""}</SheetDescription>
              </SheetHeader>
              <SheetBody contentClassName="grid gap-4">
                <section className="grid gap-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground">Texto</h3>
                  <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-3 text-sm leading-6">{selected.text || "Sem texto sincronizado."}</p>
                  {selected.variables.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selected.variables.map((variable) => <span key={variable} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{`{{${variable}}}`}</span>)}
                    </div>
                  ) : null}
                </section>
                <section className="grid gap-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground">Onde vale</h3>
                  <ValidityChips message={selected} />
                </section>
                <section className="grid gap-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground">Em uso</h3>
                  {selected.usages.length ? (
                    <ul className="grid gap-1 text-sm">{selected.usages.map((usage) => <li key={usage.label}>{usage.label}</li>)}</ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum lugar usa esta mensagem.</p>
                  )}
                  {selected.kind === "free_message" && selected.usages.length ? (
                    <p className="text-xs text-muted-foreground">Enquanto estiver em uso, ela não pode ser removida.</p>
                  ) : null}
                </section>
              </SheetBody>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
