"use client";

/**
 * Venda Automatizada (piloto, DEC-182). Blueprint: list-page (cabeçalho, uma tabela, detalhe em Sheet).
 * Um CTA primário: "Escolher lead quente". Os mesmos dados nos dois visuais (normal e Lite do diretor).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Flame, MoreHorizontalIcon, Plus } from "@/components/huge-icons";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { toast } from "@/components/ui/sonner";
import { startNextHotDealAction, stopAutoSaleWatchAction } from "@/features/auto-sale/actions";
import { CHANNEL_LABEL, MODE_LABEL, STAGE_LABEL, STATUS_LABEL } from "@/features/auto-sale/contracts";
import { BASELINE, formatUsd } from "@/features/auto-sale/metrics";
import type { AutoSaleOverview, DealDetail, DealListRow } from "@/features/auto-sale/queries";
import type { EligibleLead } from "@/features/auto-sale/service";

import { DealSheet } from "./deal-sheet";
import { formatWhen, STATUS_TONE } from "./format";
import { PickLeadSheet } from "./pick-lead-sheet";
import { PromotionsSheet } from "./promotions-sheet";

type Ready = Extract<AutoSaleOverview, { state: "ready" }>;


const columns: ColumnDef<DealListRow>[] = [
  {
    accessorKey: "leadName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
    cell: ({ row }) => (
      <span className="grid min-w-0 max-w-64 gap-0.5">
        <span className="truncate text-sm font-medium">{row.original.leadName}</span>
        <span className="truncate text-xs text-muted-foreground">{row.original.managerCallReason ?? STAGE_LABEL[row.original.stage]}</span>
      </span>
    ),
  },
  {
    id: "status",
    accessorFn: (row) => STATUS_LABEL[row.status],
    header: ({ column }) => <DataTableColumnHeader column={column} title="Situação" />,
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        <Badge variant={STATUS_TONE[row.original.status]}>{STATUS_LABEL[row.original.status]}</Badge>
        {row.original.pendingApprovals ? <Badge variant="outline">{row.original.pendingApprovals} para aprovar</Badge> : null}
      </span>
    ),
  },
  { id: "mode", header: "Modo", cell: ({ row }) => <span className="text-xs">{MODE_LABEL[row.original.mode]}</span> },
  { id: "channel", header: "Canal", cell: ({ row }) => <span className="text-xs text-muted-foreground">{CHANNEL_LABEL[row.original.channel]}</span> },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Última atividade" />,
    cell: ({ row }) => <span className="text-xs tabular-nums text-muted-foreground">{formatWhen(row.original.updatedAt)}</span>,
  },
  { id: "cost", header: "Custo de IA", cell: ({ row }) => <span className="text-xs tabular-nums">{formatUsd(row.original.costUsd)}</span> },
];

const liteColumns: LiteColumn<DealListRow>[] = [
  { id: "lead", label: "Cliente", primary: true, render: (row) => row.leadName },
  { id: "stage", label: "Etapa", secondary: true, render: (row) => row.managerCallReason ?? STAGE_LABEL[row.stage] },
  { id: "status", label: "Situação", render: (row) => <span className={page.badge} data-tone={row.status === "waiting_manager" ? "warning" : row.status === "active" ? "success" : undefined}>{STATUS_LABEL[row.status]}</span> },
  { id: "pending", label: "Para aprovar", numeric: true, render: (row) => row.pendingApprovals || "Nenhuma" },
  { id: "mode", label: "Modo", render: (row) => MODE_LABEL[row.mode] },
  { id: "channel", label: "Canal", render: (row) => CHANNEL_LABEL[row.channel] },
  { id: "updated", label: "Última atividade", numeric: true, render: (row) => formatWhen(row.updatedAt) },
];

export function AutoSaleWorkspace({ overview, lite, isDirector, preview }: { overview: AutoSaleOverview; lite: boolean; isDirector: boolean; preview?: { leads: EligibleLead[]; detail: NonNullable<DealDetail>; openDeal?: string; picking?: boolean } }) {
  const router = useRouter();
  const [picking, setPicking] = useState(preview?.picking ?? false);
  const [dealId, setDealId] = useState<string | null>(preview?.openDeal ?? null);
  const [promotions, setPromotions] = useState(false);
  const [nextPending, startingNext] = useTransition();

  if (overview.state === "migration_pending") {
    return (
      <Card>
        <SectionCardHeader icon={<Flame />} title="Venda Automatizada" description="Aguardando a migração do banco (0228). Assim que ela for aplicada, a área abre aqui." />
      </Card>
    );
  }
  const data: Ready = overview;
  const platformBlock = !data.globalEnabled ? "Pausada pela plataforma." : !data.catalogReady ? "O catálogo de planos ainda não está liberado para esta empresa." : null;
  const blockedReason = platformBlock ?? (data.openDealId ? "Já existe uma negociação aberta. Encerre ou entregue a atual para escolher outro lead." : null);
  const watching = Boolean(data.watchingSince);
  const watchText = data.watchingSince
    ? `Aguardando o próximo lead quente desde ${formatWhen(data.watchingSince)}: quando um lead ficar quente, ele entra aqui antes de ir para corretor${data.openDealId ? ", assim que a negociação aberta terminar" : ""}.`
    : null;
  const statusText = platformBlock ?? watchText ?? blockedReason;
  const description = `Um lead quente por vez. A assistente virtual cota com o catálogo real, manda as opções com o PDF e chama você quando precisa de uma pessoa. Base atual: ${BASELINE.firstMessageMinutes} min até a 1ª mensagem e ${BASELINE.quoteAfterMinutes} min até a cotação.`;
  const empty = "Nenhuma negociação ainda. Use “Pegar o próximo quente”: se não houver lead quente agora, a área aguarda o próximo.";
  // Um clique: pega o lead quente mais recente que ainda pode entrar e já começa em Copiloto (nada sai sem aprovar).
  // Sem lead quente disponível (ou com negociação aberta), liga a espera: a distribuição entrega o próximo que ficar quente.
  const pickNext = () => startingNext(async () => {
    const result = await startNextHotDealAction({ mode: "copilot" });
    if (!result.ok) { toast.error(result.error); return; }
    if (result.data.kind === "watching") {
      toast.success("Aguardando o próximo lead quente. Ele entra aqui em Copiloto antes de ir para corretor.");
      router.refresh();
      return;
    }
    toast.success(`Negociação com ${result.data.leadName} começou em Copiloto. Aprove a primeira mensagem.`);
    router.refresh();
    setDealId(result.data.dealId);
  });
  const stopWatching = () => startingNext(async () => {
    const result = await stopAutoSaleWatchAction();
    if (!result.ok) { toast.error(result.error); return; }
    toast.success("Parou de aguardar. Os próximos leads quentes seguem para os corretores.");
    router.refresh();
  });
  const cta = (
    <>
      <Button type="button" variant="outline" onClick={() => setPicking(true)} disabled={Boolean(blockedReason) || nextPending}>
        <Plus className="size-4" /> Escolher lead
      </Button>
      {watching ? (
        <Button type="button" variant="outline" onClick={stopWatching} disabled={nextPending}>Parar de aguardar</Button>
      ) : (
        <Button type="button" onClick={pickNext} disabled={Boolean(platformBlock) || nextPending} title={platformBlock ?? undefined}>
          <Flame className="size-4" /> {nextPending ? "Pegando…" : "Pegar o próximo quente"}
        </Button>
      )}
    </>
  );
  const menu = isDirector ? (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" variant="outline" aria-label="Mais ações" />}>
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setPromotions(true)}>Promoções vigentes</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  const summary = `${data.summary.total} ${data.summary.total === 1 ? "negociação" : "negociações"}, ${data.summary.documentsRequested} com documentos pedidos, ${data.summary.managerCalls} chamaram você.`;

  const sheets = (
    <>
      <PickLeadSheet key={picking ? "pick-open" : "pick-closed"} open={picking} onOpenChange={setPicking} autopilotAllowed={data.autopilotAllowed} onStarted={(id) => { setPicking(false); router.refresh(); setDealId(id); }} previewLeads={preview?.leads} />
      <DealSheet key={dealId ?? "deal-closed"} dealId={dealId} onClose={() => { setDealId(null); router.refresh(); }} autopilotAllowed={data.autopilotAllowed} previewDetail={preview && dealId ? preview.detail : undefined} />
      {isDirector ? <PromotionsSheet open={promotions} onOpenChange={setPromotions} /> : null}
    </>
  );

  if (lite) {
    return (
      <>
        <section className={page.group} aria-labelledby="auto-sale-title">
          <header className={page.cardHead}>
            <h2 id="auto-sale-title" className={page.cardTitle}>Venda Automatizada</h2>
            <p className={page.cardDescription}>{description}</p>
          </header>
          <div className={page.toolbar}>
            <span className={page.cardDescription} style={{ flex: "1 1 220px" }} aria-live="polite">{statusText ?? summary}</span>
            <div className={page.toolbarEnd}>
              {menu}
              <button type="button" className={page.button} onClick={() => setPicking(true)} disabled={Boolean(blockedReason) || nextPending}>Escolher lead</button>
              {watching
                ? <button type="button" className={page.button} onClick={stopWatching} disabled={nextPending}>Parar de aguardar</button>
                : <button type="button" className={page.primaryButton} onClick={pickNext} disabled={Boolean(platformBlock) || nextPending}>{nextPending ? "Pegando…" : "Pegar o próximo quente"}</button>}
            </div>
          </div>
          <LiteResponsiveData caption="Negociações da Venda Automatizada" columns={liteColumns} rows={data.deals} rowKey={(row) => row.id} onRowOpen={(row) => setDealId(row.id)} empty={empty} rowTone={(row) => (row.status === "waiting_manager" ? "warning" : undefined)} />
        </section>
        {sheets}
      </>
    );
  }

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <SectionCardHeader icon={<Flame />} title="Venda Automatizada" badge={<Badge variant="outline">Piloto</Badge>} description={description} actions={<>{menu}{cta}</>} />
        <div className="grid gap-3 p-4">
          <p className="text-xs text-muted-foreground" aria-live="polite">{statusText ?? summary}</p>
          <DataTable columns={columns} data={data.deals} showColumnToggle={false} pageSize={10} emptyState={<p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>} onRowClick={(row: DealListRow) => setDealId(row.id)} />
        </div>
      </Card>
      {sheets}
    </>
  );
}
