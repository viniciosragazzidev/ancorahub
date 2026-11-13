"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { SearchAddList } from "@/components/ui/search-add-list";
import { formatCents, type ErpActionResult } from "../contracts";
import { preparePayoutAction } from "../payout-actions";
import { PAYOUT_STATUSES, PAYOUT_STATUS_LABELS } from "../shared";
import type { getPayoutCandidates, getPayouts } from "../payouts";
import { ErpList, ErpMonthFilter, ErpNote, ErpPager, ErpPanel, ErpRowMenu, ErpToolbar, ErpUrlFilter, type ErpColumn } from "../ui/erp-kit";
import { FinanceFeedback } from "./finance-workspace";
import { PayoutItemsCompact, PayoutSteps, PayoutSummary, type PayoutDetailData } from "./payout-detail";
import { PayoutStatusBadge, StopRowOpen, useUrlPanel } from "./payout-parts";

type PayoutList = Awaited<ReturnType<typeof getPayouts>>;
type PayoutRow = PayoutList["rows"][number];
type Candidates = Awaited<ReturnType<typeof getPayoutCandidates>>;

const INITIAL: ErpActionResult = { ok: true, message: "" };
const STATUS_OPTIONS = [
  { value: "all", label: "Todos os estados" },
  ...PAYOUT_STATUSES.map((status) => ({ value: status, label: PAYOUT_STATUS_LABELS[status] })),
];
/** Same cap as the service schema (`entryIds` max 200). */
const MAX_ITEMS = 200;

/** Preparation drawer: one beneficiary, commissions added by search + "+", never a wall of checkboxes. */
export function PayoutPrepareForm({ candidates, onPrepared }: { candidates: Candidates; onPrepared: (id: string) => void }) {
  const [beneficiaryId, setBeneficiaryId] = useState(candidates.groups[0]?.beneficiaryId ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [requestId] = useState(() => crypto.randomUUID());
  const [result, setResult] = useState(INITIAL);
  const [pending, startTransition] = useTransition();
  const group = candidates.groups.find((row) => row.beneficiaryId === beneficiaryId);
  const items = useMemo(() => group?.items ?? [], [group]);
  const chosen = items.filter((item) => selected.includes(item.id));
  const available = items.filter((item) => !selected.includes(item.id));
  const total = chosen.reduce((sum, item) => sum + item.balanceCents, 0);
  const full = selected.length >= MAX_ITEMS;
  const add = (id: string) => setSelected((current) => (current.length >= MAX_ITEMS || current.includes(id) ? current : [...current, id]));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await preparePayoutAction(INITIAL, form);
      setResult(response);
      if (response.ok && response.id) onPrepared(response.id);
    });
  }
  if (!candidates.groups.length) {
    const scope = candidates.competence ? ` na competência ${candidates.competence}` : "";
    return <ErpNote>Nenhuma comissão aprovada com saldo fora de outro repasse{scope}.</ErpNote>;
  }
  return <form onSubmit={submit} className="flex flex-col gap-4">
    <input type="hidden" name="requestId" value={requestId} />
    <input type="hidden" name="beneficiaryId" value={beneficiaryId} />
    {selected.map((id) => <input key={id} type="hidden" name="entryId" value={id} />)}
    <ErpNote>Comissões aprovadas com saldo. O valor de cada item é o saldo depois de liquidações e compensações confirmadas.</ErpNote>
    {candidates.truncated ? <ErpNote>A lista mostra as primeiras 500 comissões. Filtre pela competência para ver as demais.</ErpNote> : null}
    <Field>
      <FieldLabel htmlFor="payout-beneficiary">Beneficiário</FieldLabel>
      <AppSelect id="payout-beneficiary" value={beneficiaryId}
        onValueChange={(value) => { setBeneficiaryId(value); setSelected([]); }}
        options={candidates.groups.map((row) => ({ value: row.beneficiaryId, label: `${row.name} · ${row.items.length} comissão(ões)` }))} />
    </Field>
    <Field>
      <FieldLabel htmlFor="payout-competence">Competência do repasse</FieldLabel>
      <Input id="payout-competence" name="competence" type="month" required defaultValue={candidates.competence ?? ""} />
    </Field>
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Comissões ({chosen.length})</p>
      <SearchAddList placeholder="Buscar comissão por referência ou descrição" emptyLabel="Nenhuma comissão com saldo encontrada." disabled={full}
        items={available.map((item) => ({ id: item.id, label: item.reference, keywords: `${item.description} ${item.competence}`,
          hint: `${item.description} · competência ${item.competence} · saldo ${formatCents(item.balanceCents)}` }))}
        onAdd={(item) => add(item.id)}
        toolbar={available.length ? <Button type="button" variant="ghost" size="sm" disabled={full}
          onClick={() => setSelected(items.slice(0, MAX_ITEMS).map((item) => item.id))}>Adicionar todas</Button> : null} />
      {chosen.length ? <ul className="flex flex-col divide-y divide-border">
        {chosen.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{item.reference}</p>
            <p className="truncate text-xs text-muted-foreground">{item.description} · competência {item.competence}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm tabular-nums">{formatCents(item.balanceCents)}</span>
            <Button type="button" variant="ghost" size="sm" aria-label={`Remover ${item.reference}`}
              onClick={() => setSelected((current) => current.filter((id) => id !== item.id))}>Remover</Button>
          </div>
        </li>)}
      </ul> : <ErpNote>Busque e adicione as comissões deste repasse.</ErpNote>}
    </div>
    <p className="text-sm">Valor líquido do repasse: <strong className="tabular-nums">{formatCents(total)}</strong></p>
    <FinanceFeedback result={result} />
    <div><Button type="submit" loading={pending} disabled={!selected.length}>Preparar para aprovação</Button></div>
  </form>;
}

/** Payouts: one list; the row opens the drawer with the summary and the step the viewer can do; "Preparar repasse" is the only CTA. */
export function PayoutsList({ data, candidates, detail, detailMissing }: {
  data: PayoutList; candidates: Candidates | null; detail: PayoutDetailData | null; detailMissing: boolean;
}) {
  const router = useRouter();
  const payoutPanel = useUrlPanel("repasse");
  const preparePanel = useUrlPanel("preparar");
  const [openId, setOpenId] = useState<string | null>(payoutPanel.value);
  const [preparing, setPreparing] = useState(preparePanel.value !== null && data.canPrepare);
  const openRow = data.rows.find((row) => row.id === openId) ?? null;
  const shown = detail && detail.id === openId ? detail : null;
  const openPayout = (id: string) => {
    setOpenId(id);
    payoutPanel.open(id);
  };
  const closePayout = () => {
    setOpenId(null);
    payoutPanel.close();
  };
  const closePrepare = () => {
    setPreparing(false);
    preparePanel.close();
  };
  const columns: ErpColumn<PayoutRow>[] = [
    { id: "beneficiary", label: "Beneficiário", primary: true, nowrap: true, render: (row) => row.beneficiaryName },
    { id: "competence", label: "Competência", secondary: true, render: (row) => row.competence },
    { id: "net", label: "Valor líquido", numeric: true, render: (row) => formatCents(row.netCents) },
    { id: "status", label: "Estado", render: (row) => <PayoutStatusBadge status={row.status} /> },
    { id: "receipt", label: "Recibo", render: (row) => row.receiptNumber ?? "—" },
    { id: "menu", label: "Ações", render: (row) => <StopRowOpen><ErpRowMenu label={`Ações do repasse de ${row.beneficiaryName}`} items={[
      { id: "details", label: "Ver detalhes", onSelect: () => openPayout(row.id) },
      { id: "page", label: "Abrir ficha completa", href: `/financeiro/repasses/${row.id}` },
      ...(row.receiptNumber ? [{ id: "receipt", label: "Abrir recibo", href: `/financeiro/recibos/${row.id}` }] : []),
    ]} /></StopRowOpen> },
  ];
  const cta = data.canPrepare
    ? <Button type="button" onClick={() => { setPreparing(true); preparePanel.open("1"); }}>Preparar repasse</Button>
    : null;
  return <>
    <ErpNote>
      Repasse agrupa comissões aprovadas de um corretor. Fluxo: preparar, aprovar (outra pessoa), registrar o pagamento com comprovante e
      conferir (outra pessoa). O recibo sai na conferência.
    </ErpNote>
    {data.agency ? <ErpToolbar>
      <ErpUrlFilter label="Estado" param="status" value={data.filters.status} defaultValue="all" options={STATUS_OPTIONS} />
      <ErpMonthFilter value={data.filters.competence ?? ""} />
    </ErpToolbar> : null}
    <ErpList title={data.agency ? "Repasses" : "Meus repasses"} actions={cta} columns={columns} rows={data.rows} rowKey={(row) => row.id}
      onRowOpen={(row) => openPayout(row.id)} emptyTitle="Nenhum repasse neste filtro"
      emptyText={data.canPrepare ? "Prepare um repasse a partir das comissões aprovadas com saldo." : "Os repasses liquidados aparecem aqui."}
      footer={<ErpPager page={data.filters.page} total={data.total} pageSize={data.pageSize} label="Paginação de repasses" />} />
    <ErpPanel open={openId !== null} onOpenChange={(open) => { if (!open) closePayout(); }}
      title={openRow ? `Repasse de ${openRow.beneficiaryName}` : "Repasse"} description={openRow ? `Competência ${openRow.competence}` : undefined}>
      {shown ? <>
        <PayoutSummary detail={shown} />
        <PayoutItemsCompact detail={shown} />
        <PayoutSteps key={shown.version} detail={shown} />
        <div><Button variant="outline" render={<Link href={`/financeiro/repasses/${shown.id}`} />}>Abrir ficha completa</Button></div>
      </> : detailMissing && payoutPanel.value === openId
        ? <ErpNote>Repasse não encontrado no seu escopo.</ErpNote>
        : <p className="text-sm text-muted-foreground" role="status">Carregando repasse…</p>}
    </ErpPanel>
    {data.canPrepare ? <ErpPanel open={preparing} onOpenChange={(open) => { if (!open) closePrepare(); }} title="Preparar repasse"
      description="Escolha o beneficiário e adicione as comissões.">
      {candidates
        ? <PayoutPrepareForm candidates={candidates} onPrepared={(id) => { setPreparing(false); router.push(`/financeiro/repasses/${id}`); }} />
        : <p className="text-sm text-muted-foreground" role="status">Carregando comissões com saldo…</p>}
    </ErpPanel> : null}
  </>;
}
