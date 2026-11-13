"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/metric-card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { formatCents, type ErpActionResult } from "../contracts";
import { INCENTIVE_METRICS, INCENTIVE_METRIC_LABELS, INCENTIVE_STATUS_LABELS, type IncentiveMetric, type IncentiveStatus } from "../incentive-core";
import {
  approveIncentiveCampaignAction, cancelIncentiveCampaignAction, contestIncentiveResultAction, getIncentiveCampaignAction, runIncentiveCalculationAction,
  saveIncentiveCampaignAction, type IncentiveCampaignData,
} from "../incentive-actions";
import type { getIncentiveCampaigns } from "../incentives";
import { ErpCell, ErpList, ErpStats, ErpNote, ErpPager, ErpPanel, ErpRowMenu, ErpSection, ErpSettingsMenu, ErpStatus, useUrlPanel, type ErpColumn, type ErpMenuItem, type ErpTone } from "../ui/erp-kit";
import { formatDay, formatInstant } from "../ui/format";

type ListData = Awaited<ReturnType<typeof getIncentiveCampaigns>>;
type ListRow = ListData["rows"][number];
type DetailData = IncentiveCampaignData;
type RankingRow = NonNullable<DetailData["latest"]>["ranking"][number];
type HistoryRow = DetailData["history"][number];
type ContestationRow = DetailData["contestations"][number];
type Branch = { id: string; name: string };
type EditableCampaign = {
  id: string; version: number; name: string; regulation: string; metric: IncentiveMetric; startsOn: string; endsOn: string; branchIds: string[]; prize: string; showNames: boolean;
};
type Mode = "view" | "edit" | "cancel";
const INITIAL: ErpActionResult = { ok: true, message: "" };
const KIND_LABELS: Record<string, string> = { preliminary: "Prévia", final: "Final" };
const DRAWER_RANKING_ROWS = 10;
const TIE_RULE = "Desempate: maior resultado; depois, quem atingiu o resultado primeiro (data do último fato válido); depois, ordem fixa de cadastro. "
  + "Premiação não gera pagamento automático.";

const day = (value: string) => formatDay(value);
const dateTime = (value: string) => formatInstant(value);
const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind;

function Feedback({ result }: { result: ErpActionResult }) {
  if (!result.message) return null;
  return result.ok ? <FieldSuccess role="status">{result.message}</FieldSuccess> : <FieldError role="alert">{result.message}</FieldError>;
}

function statusLabel(status: IncentiveStatus, startsOn: string, endsOn: string, today: string) {
  if (status !== "approved") return INCENTIVE_STATUS_LABELS[status];
  if (today < startsOn) return "Aprovada, aguardando início";
  return today > endsOn ? "Aguardando apuração final" : "Vigente";
}

function statusTone(status: IncentiveStatus, startsOn: string, endsOn: string, today: string): ErpTone {
  if (status === "draft") return "warning";
  if (status === "closed") return "success";
  if (status === "approved") return today >= startsOn && today <= endsOn ? "info" : today > endsOn ? "warning" : "neutral";
  return "neutral";
}

function StatusBadge({ status, startsOn, endsOn, today }: { status: IncentiveStatus; startsOn: string; endsOn: string; today: string }) {
  return <ErpStatus tone={statusTone(status, startsOn, endsOn, today)}>{statusLabel(status, startsOn, endsOn, today)}</ErpStatus>;
}

function formatValue(metric: IncentiveMetric, value: number | null) {
  if (value === null) return "Visível só ao participante";
  return metric === "sales_value_cents" ? formatCents(value) : value.toLocaleString("pt-BR");
}

function Details({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="grid gap-3 sm:grid-cols-2">
    {items.map((item) => <div key={item.label}>
      <dt className="text-xs text-muted-foreground">{item.label}</dt>
      <dd className="text-sm">{item.value}</dd>
    </div>)}
  </dl>;
}

function useFormAction(action: (form: FormData) => Promise<ErpActionResult>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ErpActionResult>(INITIAL);
  function run(form: FormData, onSuccess?: () => void) {
    startTransition(async () => {
      const response = await action(form);
      setResult(response);
      if (!response.ok) return;
      onSuccess?.();
      router.refresh();
    });
  }
  return { pending, result, run };
}

function CampaignForm({ branches, campaign, onSaved }: { branches: Branch[]; campaign?: EditableCampaign; onSaved: (id: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ErpActionResult>(INITIAL);
  const [metric, setMetric] = useState<string>(campaign?.metric ?? "sales_count");
  const prefix = campaign ? `incentive-${campaign.id}` : "incentive-new";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await saveIncentiveCampaignAction(INITIAL, form);
      setResult(response);
      if (response.ok && response.id) onSaved(response.id);
    });
  }
  return <form onSubmit={submit} className="flex flex-col gap-4">
    {campaign ? <><input type="hidden" name="id" value={campaign.id} /><input type="hidden" name="version" value={campaign.version} /></> : null}
    <Field>
      <FieldLabel htmlFor={`${prefix}-name`}>Nome</FieldLabel>
      <Input id={`${prefix}-name`} name="name" required minLength={3} maxLength={120} defaultValue={campaign?.name} disabled={pending} />
    </Field>
    <Field>
      <FieldLabel htmlFor={`${prefix}-metric`}>Métrica</FieldLabel>
      <AppSelect
        id={`${prefix}-metric`}
        name="metric"
        value={metric}
        onValueChange={setMetric}
        disabled={pending}
        options={INCENTIVE_METRICS.map((value) => ({ value, label: INCENTIVE_METRIC_LABELS[value] }))}
      />
      <FieldDescription>
        Vendas canceladas não contam. Valor usa o valor aprovado da venda ou, sem ele, o valor registrado. Implantação conta pelo início da cobertura.
      </FieldDescription>
    </Field>
    <div className="grid grid-cols-2 gap-3">
      <Field>
        <FieldLabel htmlFor={`${prefix}-start`}>Início</FieldLabel>
        <Input id={`${prefix}-start`} name="startsOn" type="date" required defaultValue={campaign?.startsOn} disabled={pending} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-end`}>Fim</FieldLabel>
        <Input id={`${prefix}-end`} name="endsOn" type="date" required defaultValue={campaign?.endsOn} disabled={pending} />
      </Field>
    </div>
    <FieldDescription>Datas no horário de Brasília, incluindo o primeiro e o último dia.</FieldDescription>
    <fieldset disabled={pending} className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Unidades participantes</legend>
      <FieldDescription>Sem seleção, participam todas as unidades do seu escopo.</FieldDescription>
      <div className="flex flex-wrap gap-4">
        {branches.map((branch) => <label key={branch.id} className="flex items-center gap-2 text-sm">
          <Checkbox name="branchIds" value={branch.id} defaultChecked={campaign?.branchIds.includes(branch.id)} />{branch.name}
        </label>)}
      </div>
    </fieldset>
    <Field>
      <FieldLabel htmlFor={`${prefix}-regulation`}>Regulamento</FieldLabel>
      <Textarea
        id={`${prefix}-regulation`}
        name="regulation"
        required
        minLength={20}
        maxLength={10000}
        rows={6}
        defaultValue={campaign?.regulation}
        disabled={pending}
        placeholder="Elegibilidade, desempate, contestação e entrega do prêmio"
      />
    </Field>
    <Field>
      <FieldLabel htmlFor={`${prefix}-prize`}>Premiação</FieldLabel>
      <Input id={`${prefix}-prize`} name="prize" maxLength={500} defaultValue={campaign?.prize} disabled={pending} placeholder="Descrição do prêmio" />
      <FieldDescription>Apenas descrição. A campanha não gera pagamento nem lançamento financeiro.</FieldDescription>
    </Field>
    <label className="flex items-center gap-2 text-sm">
      <Checkbox name="showNames" defaultChecked={campaign?.showNames ?? false} disabled={pending} />Mostrar nomes no ranking para os participantes
    </label>
    <FieldDescription>Desmarcado, cada participante vê apenas a própria posição identificada.</FieldDescription>
    <Feedback result={result} />
    <Button type="submit" loading={pending}>{campaign ? "Salvar rascunho" : "Criar rascunho"}</Button>
  </form>;
}

const FORM_DESCRIPTION = "O regulamento vale como publicado. Depois da aprovação, por outra pessoa, ele não muda: para alterar, cancele e crie outra campanha.";

/** "Nova campanha" drawer, opened by the header CTA (`ErpPrimaryAction`, `?novo=1`). */
function NewIncentiveCampaign({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const creating = useUrlPanel("novo");
  function saved(id: string) {
    creating.close();
    router.push(`/campanhas-incentivo/${id}`);
  }
  return <ErpPanel open={creating.open} onOpenChange={(open) => { if (!open) creating.close(); }} title="Nova campanha" description={FORM_DESCRIPTION}>
    {creating.open ? <CampaignForm branches={branches} onSaved={saved} /> : null}
  </ErpPanel>;
}

function CancelForm({ campaign, onDone }: { campaign: { id: string; version: number }; onDone: () => void }) {
  const cancel = useFormAction(cancelIncentiveCampaignAction);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancel.run(new FormData(event.currentTarget), onDone);
  }
  return <form className="flex flex-col gap-4" onSubmit={submit}>
    <input type="hidden" name="id" value={campaign.id} />
    <input type="hidden" name="version" value={campaign.version} />
    <ErpNote>O cancelamento não apaga apurações já registradas. Para mudar o regulamento, crie outra campanha depois.</ErpNote>
    <Field>
      <FieldLabel htmlFor={`incentive-cancel-reason-${campaign.id}`}>Motivo</FieldLabel>
      <Textarea id={`incentive-cancel-reason-${campaign.id}`} name="reason" required minLength={5} maxLength={500} disabled={cancel.pending} />
    </Field>
    <Feedback result={cancel.result} />
    <Button type="submit" variant="destructive" loading={cancel.pending}>Confirmar cancelamento</Button>
  </form>;
}

/**
 * Status actions of a campaign: the single primary action of the state as a button, the rest in "Mais ações".
 * `onMode` lets a drawer swap its own content for the edit/cancel forms instead of stacking another panel.
 */
function CampaignActions({ data, onMode, onChanged }: { data: DetailData; onMode?: (mode: Mode) => void; onChanged?: () => void }) {
  const { campaign, can } = data;
  const [mode, setMode] = useState<Mode>("view");
  const approve = useFormAction(approveIncentiveCampaignAction);
  const calculate = useFormAction(runIncentiveCalculationAction);
  const pending = approve.pending || calculate.pending;
  if (!data.canManage) return null;
  const openMode = (next: Mode) => (onMode ? onMode(next) : setMode(next));
  const base = () => {
    const form = new FormData();
    form.set("id", campaign.id);
    form.set("version", String(campaign.version));
    return form;
  };
  const runKind = (kind: "preliminary" | "final") => {
    const form = base();
    form.set("kind", kind);
    calculate.run(form, onChanged);
  };
  const primary = can.approve ? "approve" : can.final ? "final" : can.preliminary ? "preliminary" : null;
  const more: ErpMenuItem[] = [
    ...(can.preliminary && primary !== "preliminary" ? [{ id: "preliminary", label: "Apuração prévia", onSelect: () => runKind("preliminary"), disabled: pending }] : []),
    ...(can.edit ? [{ id: "edit", label: "Editar rascunho", onSelect: () => openMode("edit"), disabled: pending }] : []),
    ...(can.cancel ? [{ id: "cancel", label: "Cancelar campanha", onSelect: () => openMode("cancel"), tone: "danger" as const, disabled: pending }] : []),
  ];
  const editable: EditableCampaign = { ...campaign };
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      {primary === "approve" ? <Button type="button" loading={approve.pending} disabled={pending} onClick={() => approve.run(base(), onChanged)}>Aprovar campanha</Button> : null}
      {primary === "final" ? <Button type="button" loading={calculate.pending} disabled={pending} onClick={() => runKind("final")}>Apuração final e encerrar</Button> : null}
      {primary === "preliminary" ? <Button type="button" loading={calculate.pending} disabled={pending} onClick={() => runKind("preliminary")}>Apuração prévia</Button> : null}
      <ErpSettingsMenu label="Mais ações" items={more} />
    </div>
    {campaign.status === "draft" && data.preparedByViewer
      ? <ErpNote>Você preparou esta versão. A aprovação precisa ser feita por outra pessoa autorizada.</ErpNote> : null}
    {campaign.status === "approved" && !can.final
      ? <ErpNote>A apuração final fica disponível depois de {day(campaign.endsOn)}. Prévias podem ser feitas a qualquer momento.</ErpNote> : null}
    <Feedback result={approve.result} />
    <Feedback result={calculate.result} />
    {onMode ? null : <>
      <ErpPanel open={mode === "edit"} onOpenChange={(open) => setMode(open ? "edit" : "view")} title="Editar rascunho" description={FORM_DESCRIPTION}>
        {can.edit ? <CampaignForm key={`${campaign.id}-${campaign.version}`} branches={data.branches} campaign={editable} onSaved={() => setMode("view")} /> : null}
      </ErpPanel>
      <ErpPanel open={mode === "cancel"} onOpenChange={(open) => setMode(open ? "cancel" : "view")} title="Cancelar campanha">
        <CancelForm campaign={campaign} onDone={() => setMode("view")} />
      </ErpPanel>
    </>}
  </div>;
}

function RegulationDetails({ data }: { data: DetailData }) {
  const { campaign } = data;
  const approval = campaign.approvedBy ? ` · aprovada por ${campaign.approvedBy}` : " · aguardando aprovação";
  return <div className="flex flex-col gap-3">
    <Details items={[
      { label: "Situação", value: <StatusBadge status={campaign.status} startsOn={campaign.startsOn} endsOn={campaign.endsOn} today={data.today} /> },
      { label: "Métrica", value: INCENTIVE_METRIC_LABELS[campaign.metric] },
      { label: "Período", value: `${day(campaign.startsOn)} a ${day(campaign.endsOn)} (horário de Brasília)` },
      { label: "Unidades", value: campaign.branchNames.length ? campaign.branchNames.join(", ") : "Todas as unidades" },
      { label: "Premiação", value: campaign.prize || "Não informada" },
      { label: "Exposição", value: campaign.showNames ? "Nomes visíveis no ranking" : "Participantes veem apenas a própria posição identificada" },
      { label: "Preparação e aprovação", value: `${campaign.preparedBy}${approval}` },
      { label: "Versão do regulamento", value: String(campaign.version) },
    ]} />
    <p className="whitespace-pre-wrap text-sm">{campaign.regulation}</p>
    <ErpNote>{TIE_RULE}</ErpNote>
    {campaign.status === "cancelled" ? <p className="text-sm">Motivo do cancelamento: {campaign.reason}</p> : null}
  </div>;
}

function rankingEmpty(data: DetailData) {
  if (data.latest) {
    return { title: "Nenhum fato elegível", text: "A apuração não encontrou vendas ou implantações válidas no período e nas unidades da campanha." };
  }
  const text = data.campaign.status === "draft"
    ? "A campanha precisa ser aprovada antes da primeira apuração."
    : "O ranking aparece depois da primeira apuração registrada.";
  return { title: "Sem apuração", text };
}

function DrawerRanking({ data }: { data: DetailData }) {
  const { latest } = data;
  if (!latest || !latest.ranking.length) {
    const empty = rankingEmpty(data);
    return <p className="text-sm text-muted-foreground">{empty.title}. {empty.text}</p>;
  }
  const top = latest.ranking.slice(0, DRAWER_RANKING_ROWS);
  const viewerRow = latest.ranking.find((row) => row.isViewer);
  const rows = viewerRow && !top.includes(viewerRow) ? [...top, viewerRow] : top;
  return <div className="flex flex-col gap-2">
    <ErpNote>Apuração {kindLabel(latest.kind).toLowerCase()} de {dateTime(latest.createdAt)} · {INCENTIVE_METRIC_LABELS[latest.metric]}</ErpNote>
    <ol className="flex flex-col gap-2">
      {rows.map((row) => <li key={row.position} className="flex items-center justify-between gap-3 text-sm" aria-current={row.isViewer ? "true" : undefined}>
        <span className="min-w-0 truncate">{row.position}º · {row.isViewer ? <strong>{row.label}</strong> : row.label}</span>
        <span className="tabular-nums">{formatValue(latest.metric, row.value)}</span>
      </li>)}
    </ol>
  </div>;
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="flex flex-col gap-3" aria-label={title}>
    <h3 className="text-sm font-medium">{title}</h3>
    {children}
  </section>;
}

function CampaignDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("view");
  const [, startLoading] = useTransition();
  const load = useCallback(() => startLoading(async () => {
    const response = await getIncentiveCampaignAction(id);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setError("");
    setData(response.data);
  }), [id]);
  useEffect(() => {
    load();
  }, [load]);
  const back = () => {
    setMode("view");
    load();
  };
  const title = data ? mode === "edit" ? "Editar rascunho" : mode === "cancel" ? "Cancelar campanha" : data.campaign.name : "Campanha";
  return <ErpPanel open onOpenChange={(open) => { if (!open) onClose(); }} title={title} description={mode === "edit" ? FORM_DESCRIPTION : undefined}>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    {!data && !error ? <p className="text-sm text-muted-foreground" role="status">Carregando campanha…</p> : null}
    {data && mode === "edit" && data.can.edit
      ? <CampaignForm branches={data.branches} campaign={{ ...data.campaign }} onSaved={back} /> : null}
    {data && mode === "cancel" ? <CancelForm campaign={data.campaign} onDone={back} /> : null}
    {data && mode !== "view"
      ? <Button type="button" variant="ghost" onClick={() => setMode("view")}>Voltar ao resumo</Button> : null}
    {data && mode === "view" ? <>
      <CampaignActions data={data} onMode={setMode} onChanged={load} />
      <DrawerSection title="Regulamento"><RegulationDetails data={data} /></DrawerSection>
      <DrawerSection title="Ranking mais recente"><DrawerRanking data={data} /></DrawerSection>
      <Button variant="outline" render={<Link href={`/campanhas-incentivo/${data.campaign.id}`} />}>Abrir ficha completa</Button>
    </> : null}
  </ErpPanel>;
}

export function IncentivesWorkspace({ data }: { data: ListData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = data.filters.status !== "all" || !!data.filters.q;
  const menu = (row: ListRow): ErpMenuItem[] => [
    { id: "open", label: "Ver resumo", onSelect: () => setSelectedId(row.id) },
    { id: "page", label: "Abrir ficha completa", href: `/campanhas-incentivo/${row.id}` },
  ];
  const columns: ErpColumn<ListRow>[] = [
    { id: "name", label: "Campanha", primary: true, render: (row) => <ErpCell title={row.name} sub={INCENTIVE_METRIC_LABELS[row.metric]} /> },
    { id: "period", label: "Período", nowrap: true, render: (row) => `${day(row.startsOn)} a ${day(row.endsOn)}` },
    { id: "status", label: "Situação", render: (row) => <StatusBadge status={row.status} startsOn={row.startsOn} endsOn={row.endsOn} today={data.today} /> },
    { id: "last", label: "Última apuração", nowrap: true, secondary: true, render: (row) => row.lastCalculatedAt ? dateTime(row.lastCalculatedAt) : "Sem apuração" },
    { id: "menu", label: "", render: (row) => <ErpRowMenu label={`Ações de ${row.name}`} items={menu(row)} /> },
  ];
  const emptyText = data.canManage
    ? "Crie um rascunho com regulamento, período e métrica. Outra pessoa autorizada aprova antes da apuração."
    : "As campanhas aprovadas para sua unidade aparecem aqui.";
  return <>
    <ErpList
      title="Campanhas"
      count={data.total}
      countLabel={["campanha", "campanhas"]}
      columns={columns}
      rows={data.rows}
      rowKey={(row) => row.id}
      onRowOpen={(row) => setSelectedId(row.id)}
      emptyTitle={filtered ? "Nenhuma campanha nesta situação" : "Nenhuma campanha no seu escopo"}
      emptyText={filtered ? "Ajuste a busca ou o filtro de situação." : emptyText}
      footer={<ErpPager page={data.filters.page} total={data.total} pageSize={data.pageSize} label="Paginação de campanhas" />}
    />
    {selectedId ? <CampaignDrawer key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    {data.canManage ? <NewIncentiveCampaign branches={data.branches} /> : null}
  </>;
}

function Contest({ data }: { data: DetailData }) {
  const [open, setOpen] = useState(false);
  const contest = useFormAction(contestIncentiveResultAction);
  if (!data.latest || !data.can.contest) return null;
  const latest = data.latest;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    contest.run(new FormData(event.currentTarget), () => setOpen(false));
  }
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>Contestar resultado</Button>
    <ErpPanel open={open} onOpenChange={setOpen} title="Contestar resultado" description="A gestão analisa sua nota. O resultado registrado não muda automaticamente.">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <input type="hidden" name="resultId" value={latest.id} />
        <input type="hidden" name="campaignId" value={data.campaign.id} />
        <Field>
          <FieldLabel htmlFor="incentive-contest-note">O que precisa ser revisto</FieldLabel>
          <Textarea
            id="incentive-contest-note"
            name="note"
            required
            minLength={5}
            maxLength={1000}
            disabled={contest.pending}
            placeholder="Ex.: venda de 12/11 não apareceu na minha contagem"
          />
        </Field>
        <Feedback result={contest.result} />
        <Button type="submit" loading={contest.pending}>Enviar contestação</Button>
      </form>
    </ErpPanel>
    {contest.result.ok ? <Feedback result={contest.result} /> : null}
  </>;
}

/** Page-header actions of the full view: the state's primary action and "Mais ações". */
export function IncentiveCampaignActions({ data }: { data: DetailData }) {
  return <CampaignActions data={data} />;
}

export function IncentiveCampaignDetail({ data }: { data: DetailData }) {
  const { latest } = data;
  const empty = rankingEmpty(data);
  const metric = latest?.metric ?? data.campaign.metric;
  const rankingColumns: ErpColumn<RankingRow>[] = [
    { id: "position", label: "Posição", numeric: true, render: (row) => `${row.position}º` },
    { id: "label", label: "Participante", primary: true, render: (row) => row.isViewer ? <strong>{row.label}</strong> : row.label },
    { id: "value", label: INCENTIVE_METRIC_LABELS[metric], numeric: true, render: (row) => formatValue(metric, row.value) },
  ];
  const historyColumns: ErpColumn<HistoryRow>[] = [
    { id: "date", label: "Data", primary: true, nowrap: true, render: (row) => dateTime(row.createdAt) },
    { id: "kind", label: "Tipo", render: (row) => kindLabel(row.kind) },
    { id: "version", label: "Versão", numeric: true, render: (row) => row.campaignVersion },
    { id: "author", label: "Responsável", nowrap: true, render: (row) => row.createdBy },
    { id: "digest", label: "Assinatura", render: (row) => <code className="text-xs">{row.digest}</code> },
  ];
  const contestationColumns: ErpColumn<ContestationRow>[] = [
    { id: "date", label: "Data", nowrap: true, render: (row) => dateTime(row.createdAt) },
    { id: "author", label: "Participante", primary: true, render: (row) => row.author },
    { id: "position", label: "Posição", numeric: true, render: (row) => row.position ? `${row.position}º` : "—" },
    { id: "note", label: "Nota", render: (row) => <span className="whitespace-pre-wrap">{row.note}</span> },
  ];
  const rankingTitle = latest ? `Ranking · apuração ${kindLabel(latest.kind).toLowerCase()} de ${dateTime(latest.createdAt)}` : "Ranking";
  const viewer = latest?.ranking.find((row) => row.isViewer) ?? null;
  const { campaign } = data;
  return <>
    <ErpStats>
      <StatCard label="Situação" value={statusLabel(campaign.status, campaign.startsOn, campaign.endsOn, data.today)} sublabel={INCENTIVE_METRIC_LABELS[campaign.metric]} />
      <StatCard label="Período" value={`${day(campaign.startsOn)} a ${day(campaign.endsOn)}`} sublabel="horário de Brasília" />
      <StatCard label="Participantes no ranking" value={(latest?.ranking.length ?? 0).toLocaleString("pt-BR")} sublabel={viewer ? `Sua posição: ${viewer.position}º` : "pela apuração mais recente"} />
      <StatCard label="Última apuração" value={latest ? kindLabel(latest.kind) : "Sem apuração"} sublabel={latest ? dateTime(latest.createdAt) : "aparece depois da primeira apuração"} />
    </ErpStats>
    <ErpSection title="Regulamento" description={`Versão ${data.campaign.version} do regulamento`}>
      <RegulationDetails data={data} />
    </ErpSection>
    <ErpList
      title={rankingTitle}
      actions={<Contest data={data} />}
      columns={rankingColumns}
      rows={latest?.ranking ?? []}
      rowKey={(row) => String(row.position)}
      emptyTitle={empty.title}
      emptyText={empty.text}
    />
    <ErpList
      title="Histórico de apurações"
      description="A assinatura se repete quando os mesmos fatos são apurados com a mesma versão do regulamento."
      columns={historyColumns}
      rows={data.history}
      rowKey={(row) => row.id}
      emptyTitle="Nenhuma apuração registrada"
      emptyText="Prévias e a apuração final aparecem aqui com data, versão e assinatura."
      footer={<ErpPager page={data.historyPage} total={data.historyTotal} pageSize={data.pageSize} label="Paginação das apurações" />}
    />
    <ErpList
      title={data.canManage ? "Contestações" : "Suas contestações"}
      columns={contestationColumns}
      rows={data.contestations}
      rowKey={(row) => row.id}
      emptyTitle="Nenhuma contestação"
      emptyText="Participantes podem contestar a apuração mais recente; o resultado registrado não muda automaticamente."
    />
  </>;
}
