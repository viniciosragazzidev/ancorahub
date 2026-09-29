"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ArrowsClockwise, ChevronDownIcon, Gear, Plus } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import type { MessageKind } from "@/features/message-library/catalog";
import type { LibraryMessage } from "@/features/message-library/service";
import { cn } from "@/lib/utils";
import { MessagePoliciesPanel } from "../../../qualificacao/_components/message-policies-panel";
import { TemplateBuilderWizard } from "../../../integrations/whatsapp/_components/template-builder-wizard";
import { MessageDrawer, type DrawerTarget } from "./message-drawer";

type KindFilter = "all" | MessageKind;

const kindVariant: Record<MessageKind, "info" | "secondary" | "outline"> = {
  meta_template: "info",
  free_message: "secondary",
  quick_reply: "outline",
};

/** Compact "where it is valid" for the table: one chip per channel it can use. */
function ChannelChips({ message }: { message: LibraryMessage }) {
  const short: Record<string, string> = {
    "meta:always": "Meta",
    "meta:window": message.kind === "quick_reply" ? "Meta · na conversa" : "Meta · 24h",
    "company_number:always": "WhatsApp da empresa",
    "company_number:window": "WhatsApp da empresa · na conversa",
  };
  return (
    <span className="flex flex-wrap gap-1">
      {message.validity.filter((item) => item.valid !== "never").map((item) => (
        <span key={item.channel} title={item.label} className={cn("rounded-full border border-border px-2 py-0.5 text-[11px]", item.valid === "always" ? "text-foreground" : "text-muted-foreground")}>
          {short[`${item.channel}:${item.valid}`] ?? item.label}
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
    id: "channel",
    header: "Canal",
    cell: ({ row }) => <ChannelChips message={row.original} />,
  },
  {
    id: "usages",
    accessorFn: (message) => message.usages.length,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Em uso" />,
    cell: ({ row }) => row.original.usages.length
      ? <span className="text-xs">{row.original.usages.length === 1 ? row.original.usages[0]!.label : `${row.original.usages.length} lugares`}</span>
      : <span className="text-xs text-muted-foreground">Não usada</span>,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.status}</span>,
  },
];

/**
 * One table for every message: Meta templates, free texts and the AI's
 * answers. A row opens its drawer (edit, preview, where it is valid, where it
 * is used and through which channel). "Nova mensagem" is the screen's single
 * primary action; syncing and the per-situation rules live in "Configurações".
 */
export function MessagesWorkspace({ messages }: { messages: LibraryMessage[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<KindFilter>("all");
  const [target, setTarget] = useState<DrawerTarget>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [preferred, setPreferred] = useState<{ templateId: string; eventKey: string } | null>(null);
  const [syncing, startSync] = useTransition();

  const counts = useMemo(() => ({
    all: messages.length,
    meta_template: messages.filter((message) => message.kind === "meta_template").length,
    free_message: messages.filter((message) => message.kind === "free_message").length,
    quick_reply: messages.filter((message) => message.kind === "quick_reply").length,
  }), [messages]);
  const rows = filter === "all" ? messages : messages.filter((message) => message.kind === filter);
  const inUse = messages.filter((message) => message.usages.length).length;

  // After a change the server page reloads the list; the open drawer follows the fresh row.
  const refresh = () => router.refresh();
  const openRow = (message: LibraryMessage) => setTarget({ mode: "view", message });
  const current = target?.mode === "view" ? messages.find((message) => message.id === target.message.id) : null;
  const drawerTarget: DrawerTarget = target?.mode === "view" ? (current ? { mode: "view", message: current } : null) : target;

  const sync = () => startSync(async () => {
    const response = await fetch("/api/integrations/whatsapp/templates/sync", { method: "POST" }).catch(() => null);
    if (!response?.ok) { toast.error("Não foi possível sincronizar com a Meta agora."); return; }
    toast.success("Templates sincronizados com a Meta.");
    refresh();
  });

  return (
    <Card variant="overview">
      <SectionCardHeader
        title="Mensagens"
        badge={<Badge variant="secondary">{messages.length} mensagens · {inUse} em uso</Badge>}
        description="Tudo o que o sistema envia para clientes e para a equipe. Clique numa mensagem para ver onde ela vale, onde é usada e por qual canal sai."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
                <Gear className="size-3.5" />
                Configurações
                <ChevronDownIcon className="size-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem onClick={() => setPoliciesOpen(true)}>
                  <Gear className="size-3.5" /> Mensagem de cada situação
                </DropdownMenuItem>
                <DropdownMenuItem disabled={syncing} onClick={sync}>
                  <ArrowsClockwise className={cn("size-3.5", syncing && "animate-spin")} /> Sincronizar templates da Meta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" />}>
                <Plus className="size-3.5" />
                Nova mensagem
                <ChevronDownIcon className="size-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem onClick={() => setTarget({ mode: "new_free" })}>
                  <span className="grid gap-0.5">
                    <span>Texto livre</span>
                    <span className="text-xs text-muted-foreground">WhatsApp da empresa a qualquer hora; Meta só na janela de 24h</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setWizardOpen(true)}>
                  <span className="grid gap-0.5">
                    <span>Template da Meta</span>
                    <span className="text-xs text-muted-foreground">Vai para aprovação da Meta; depois sai a qualquer hora</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <div className="grid gap-3 p-4">
        <DsSegmentedControl<KindFilter>
          aria-label="Filtrar por tipo"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: `Todas (${counts.all})` },
            { value: "meta_template", label: `Templates Meta (${counts.meta_template})` },
            { value: "free_message", label: `Textos livres (${counts.free_message})` },
            { value: "quick_reply", label: `Respostas da IA (${counts.quick_reply})` },
          ]}
          className="max-w-full overflow-x-auto"
        />
        <DataTable columns={columns} data={rows} searchKey="name" searchPlaceholder="Buscar mensagem" pageSize={15} onRowClick={openRow} />
      </div>

      <MessageDrawer
        target={drawerTarget}
        onClose={() => setTarget(null)}
        onChanged={refresh}
        onUseInSituation={(templateId, eventKey) => {
          setTarget(null);
          setPreferred({ templateId, eventKey });
          setPoliciesOpen(true);
        }}
      />

      <Sheet open={policiesOpen} onOpenChange={setPoliciesOpen}>
        <SheetContent className="data-[side=right]:w-[min(100vw-1rem,56rem)]">
          <SheetHeader>
            <SheetTitle>Mensagem de cada situação</SheetTitle>
            <SheetDescription>Qual template ou texto sai em cada momento do atendimento, com a contingência. Vale depois de salvar e publicar.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <MessagePoliciesPanel
              canManage
              preferredMetaTemplateId={preferred?.templateId ?? null}
              preferredEventKey={preferred?.eventKey ?? null}
              onPreferredMetaTemplateApplied={() => setPreferred(null)}
            />
          </SheetBody>
        </SheetContent>
      </Sheet>

      {wizardOpen ? (
        <TemplateBuilderWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onSuccess={() => { setWizardOpen(false); refresh(); }} />
      ) : null}
    </Card>
  );
}
