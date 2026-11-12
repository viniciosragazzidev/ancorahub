"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel, FieldSuccess } from "@/components/ui/field";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCents, type ErpActionResult } from "../contracts";
import { INCENTIVE_METRICS, INCENTIVE_METRIC_LABELS, INCENTIVE_STATUS_LABELS, type IncentiveMetric, type IncentiveStatus } from "../incentive-core";
import { approveIncentiveCampaignAction, cancelIncentiveCampaignAction, contestIncentiveResultAction, runIncentiveCalculationAction, saveIncentiveCampaignAction } from "../incentive-actions";
import type { getIncentiveCampaign, getIncentiveCampaigns } from "../incentives";
import page from "@/components/lite/page/lite-page.module.css";

type ListData = Awaited<ReturnType<typeof getIncentiveCampaigns>>;
type DetailData = Awaited<ReturnType<typeof getIncentiveCampaign>>;
type Branch = { id: string; name: string };
type EditableCampaign = { id: string; version: number; name: string; regulation: string; metric: IncentiveMetric; startsOn: string; endsOn: string; branchIds: string[]; prize: string; showNames: boolean };
const INITIAL: ErpActionResult = { ok: true, message: "" };

const day = (value: string) => value.split("-").reverse().join("/");
const dateTime = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const KIND_LABELS: Record<string, string> = { preliminary: "Prévia", final: "Final" };

function Feedback({ result }: { result: ErpActionResult }) {
  return result.message ? result.ok ? <FieldSuccess role="status">{result.message}</FieldSuccess> : <FieldError role="alert">{result.message}</FieldError> : null;
}

function statusLabel(status: IncentiveStatus, startsOn: string, endsOn: string, today: string) {
  if (status !== "approved") return INCENTIVE_STATUS_LABELS[status];
  if (today < startsOn) return "Aprovada, aguardando início";
  return today > endsOn ? "Aguardando apuração final" : "Vigente";
}
function StatusBadge({ status, startsOn, endsOn, today }: { status: IncentiveStatus; startsOn: string; endsOn: string; today: string }) {
  const variant = status === "draft" ? "secondary" : status === "approved" ? "info" : status === "closed" ? "success" : "outline";
  return <Badge variant={variant}>{statusLabel(status, startsOn, endsOn, today)}</Badge>;
}

function CampaignForm({ branches, campaign, open, onOpenChange }: { branches: Branch[]; campaign?: EditableCampaign; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ErpActionResult>(INITIAL);
  const [metric, setMetric] = useState<string>(campaign?.metric ?? "sales_count");
  const prefix = campaign ? `incentive-${campaign.id}` : "incentive-new";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await saveIncentiveCampaignAction(INITIAL, form); setResult(response);
      if (response.ok && response.id) { onOpenChange(false); if (campaign) router.refresh(); else router.push(`/campanhas-incentivo/${response.id}`); }
    });
  }
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent><SheetHeader><SheetTitle>{campaign ? "Editar rascunho" : "Nova campanha"}</SheetTitle>
    <SheetDescription>O regulamento vale como publicado. Depois da aprovação, por outra pessoa, ele não muda: para alterar, cancele e crie outra campanha.</SheetDescription></SheetHeader>
    <SheetBody contentClassName={page.stack}><form onSubmit={submit} className={page.group}>
      {campaign ? <><input type="hidden" name="id" value={campaign.id} /><input type="hidden" name="version" value={campaign.version} /></> : null}
      <Field><FieldLabel htmlFor={`${prefix}-name`}>Nome</FieldLabel><Input id={`${prefix}-name`} name="name" required minLength={3} maxLength={120} defaultValue={campaign?.name} disabled={pending} /></Field>
      <Field><FieldLabel htmlFor={`${prefix}-metric`}>Métrica</FieldLabel><AppSelect id={`${prefix}-metric`} name="metric" value={metric} onValueChange={setMetric} disabled={pending} options={INCENTIVE_METRICS.map((value) => ({ value, label: INCENTIVE_METRIC_LABELS[value] }))} />
        <p className="text-sm text-muted-foreground">Vendas canceladas não contam. Valor usa o valor aprovado da venda ou, sem ele, o valor registrado. Implantação conta pelo início da cobertura.</p></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field><FieldLabel htmlFor={`${prefix}-start`}>Início</FieldLabel><Input id={`${prefix}-start`} name="startsOn" type="date" required defaultValue={campaign?.startsOn} disabled={pending} /></Field>
        <Field><FieldLabel htmlFor={`${prefix}-end`}>Fim</FieldLabel><Input id={`${prefix}-end`} name="endsOn" type="date" required defaultValue={campaign?.endsOn} disabled={pending} /></Field>
      </div>
      <p className="text-sm text-muted-foreground">Datas no horário de Brasília, incluindo o primeiro e o último dia.</p>
      <fieldset disabled={pending} className={page.group}><legend className="text-sm font-medium">Unidades participantes</legend>
        <p className="text-sm text-muted-foreground">Sem seleção, participam todas as unidades do seu escopo.</p>
        <div className="flex flex-wrap gap-4">{branches.map((branch) => <label key={branch.id} className="flex items-center gap-2 text-sm"><Checkbox name="branchIds" value={branch.id} defaultChecked={campaign?.branchIds.includes(branch.id)} />{branch.name}</label>)}</div>
      </fieldset>
      <Field><FieldLabel htmlFor={`${prefix}-regulation`}>Regulamento</FieldLabel><Textarea id={`${prefix}-regulation`} name="regulation" required minLength={20} maxLength={10000} rows={6} defaultValue={campaign?.regulation} disabled={pending} placeholder="Elegibilidade, desempate, contestação e entrega do prêmio" /></Field>
      <Field><FieldLabel htmlFor={`${prefix}-prize`}>Premiação</FieldLabel><Input id={`${prefix}-prize`} name="prize" maxLength={500} defaultValue={campaign?.prize} disabled={pending} placeholder="Descrição do prêmio" />
        <p className="text-sm text-muted-foreground">Apenas descrição. A campanha não gera pagamento nem lançamento financeiro.</p></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox name="showNames" defaultChecked={campaign?.showNames ?? false} disabled={pending} />Mostrar nomes no ranking para os participantes</label>
      <p className="text-sm text-muted-foreground">Desmarcado, cada participante vê apenas a própria posição identificada.</p>
      <Feedback result={result} /><Button type="submit" loading={pending}>{campaign ? "Salvar rascunho" : "Criar rascunho"}</Button>
    </form></SheetBody></SheetContent></Sheet>;
}

export function NewIncentiveCampaign({ branches }: { branches: Branch[] }) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return <><Button onClick={() => { setKey((value) => value + 1); setOpen(true); }}>Nova campanha</Button><CampaignForm key={key} branches={branches} open={open} onOpenChange={setOpen} /></>;
}

export function IncentivesList({ data }: { data: ListData }) {
  if (!data.rows.length) return <div className={page.empty}><h2 className={page.emptyTitle}>Nenhuma campanha no seu escopo</h2><p className={page.emptyText}>{data.canManage ? "Crie um rascunho com regulamento, período e métrica. Outra pessoa autorizada aprova antes da apuração." : "As campanhas aprovadas para sua unidade aparecem aqui."}</p></div>;
  return <Table><TableHeader><TableRow><TableHead>Campanha</TableHead><TableHead>Métrica</TableHead><TableHead>Período</TableHead><TableHead>Situação</TableHead><TableHead>Última apuração</TableHead></TableRow></TableHeader>
    <TableBody>{data.rows.map((row) => <TableRow key={row.id}>
      <TableCell><Link href={`/campanhas-incentivo/${row.id}`} className={page.cellLink}>{row.name}</Link></TableCell>
      <TableCell>{INCENTIVE_METRIC_LABELS[row.metric]}</TableCell>
      <TableCell>{day(row.startsOn)} a {day(row.endsOn)}</TableCell>
      <TableCell><StatusBadge status={row.status} startsOn={row.startsOn} endsOn={row.endsOn} today={data.today} /></TableCell>
      <TableCell>{row.lastCalculatedAt ? dateTime(row.lastCalculatedAt) : "Sem apuração"}</TableCell>
    </TableRow>)}</TableBody></Table>;
}

function useFormAction(action: (form: FormData) => Promise<ErpActionResult>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ErpActionResult>(INITIAL);
  function run(form: FormData, onSuccess?: () => void) {
    startTransition(async () => { const response = await action(form); setResult(response); if (response.ok) { onSuccess?.(); router.refresh(); } });
  }
  return { pending, result, run };
}

function CampaignActions({ data }: { data: DetailData }) {
  const { campaign, can } = data;
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const approve = useFormAction(approveIncentiveCampaignAction);
  const calculate = useFormAction(runIncentiveCalculationAction);
  const cancel = useFormAction(cancelIncentiveCampaignAction);
  const pending = approve.pending || calculate.pending || cancel.pending;
  const base = () => { const form = new FormData(); form.set("id", campaign.id); form.set("version", String(campaign.version)); return form; };
  const runKind = (kind: "preliminary" | "final") => { const form = base(); form.set("kind", kind); calculate.run(form); };
  // Exactly one primary action per state; the rest stay secondary.
  const primary = can.approve ? "approve" : can.final ? "final" : can.preliminary ? "preliminary" : null;
  if (!data.canManage) return null;
  return <section className={page.group} aria-label="Ações da campanha">
    <div className="flex flex-wrap gap-2">
      {can.approve ? <Button variant={primary === "approve" ? "default" : "outline"} loading={approve.pending} disabled={pending} onClick={() => approve.run(base())}>Aprovar campanha</Button> : null}
      {can.final ? <Button variant={primary === "final" ? "default" : "outline"} loading={calculate.pending} disabled={pending} onClick={() => runKind("final")}>Apuração final e encerrar</Button> : null}
      {can.preliminary ? <Button variant={primary === "preliminary" ? "default" : "outline"} loading={calculate.pending} disabled={pending} onClick={() => runKind("preliminary")}>Apuração prévia</Button> : null}
      {can.edit ? <Button variant="outline" disabled={pending} onClick={() => setEditing(true)}>Editar rascunho</Button> : null}
      {can.cancel ? <Button variant="outline" disabled={pending} onClick={() => setCancelling(true)}>Cancelar campanha</Button> : null}
    </div>
    {campaign.status === "draft" && data.preparedByViewer ? <p className="text-sm text-muted-foreground">Você preparou esta versão. A aprovação precisa ser feita por outra pessoa autorizada.</p> : null}
    {campaign.status === "approved" && !can.final ? <p className="text-sm text-muted-foreground">A apuração final fica disponível depois de {day(campaign.endsOn)}. Prévias podem ser feitas a qualquer momento.</p> : null}
    <Feedback result={approve.result} /><Feedback result={calculate.result} />
    {can.edit ? <CampaignForm key={`${campaign.id}-${campaign.version}`} branches={data.branches} open={editing} onOpenChange={setEditing} campaign={campaign} /> : null}
    <Sheet open={cancelling} onOpenChange={setCancelling}><SheetContent><SheetHeader><SheetTitle>Cancelar campanha</SheetTitle><SheetDescription>O cancelamento não apaga apurações já registradas. Para mudar o regulamento, crie outra campanha depois.</SheetDescription></SheetHeader>
      <SheetBody contentClassName={page.stack}><form className={page.group} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); cancel.run(form, () => setCancelling(false)); }}>
        <input type="hidden" name="id" value={campaign.id} /><input type="hidden" name="version" value={campaign.version} />
        <Field><FieldLabel htmlFor="incentive-cancel-reason">Motivo</FieldLabel><Textarea id="incentive-cancel-reason" name="reason" required minLength={5} maxLength={500} disabled={cancel.pending} /></Field>
        <Feedback result={cancel.result} /><Button type="submit" variant="destructive" loading={cancel.pending}>Confirmar cancelamento</Button>
      </form></SheetBody></SheetContent></Sheet>
  </section>;
}

function formatValue(metric: IncentiveMetric, value: number | null) {
  if (value === null) return "Visível só ao participante";
  return metric === "sales_value_cents" ? formatCents(value) : value.toLocaleString("pt-BR");
}

function Contest({ data }: { data: DetailData }) {
  const [open, setOpen] = useState(false);
  const contest = useFormAction(contestIncentiveResultAction);
  if (!data.latest || !data.can.contest) return null;
  return <><Button variant="outline" onClick={() => setOpen(true)}>Contestar resultado</Button>
    <Sheet open={open} onOpenChange={setOpen}><SheetContent><SheetHeader><SheetTitle>Contestar resultado</SheetTitle><SheetDescription>A gestão analisa sua nota. O resultado registrado não muda automaticamente.</SheetDescription></SheetHeader>
      <SheetBody contentClassName={page.stack}><form className={page.group} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); contest.run(form, () => setOpen(false)); }}>
        <input type="hidden" name="resultId" value={data.latest.id} /><input type="hidden" name="campaignId" value={data.campaign.id} />
        <Field><FieldLabel htmlFor="incentive-contest-note">O que precisa ser revisto</FieldLabel><Textarea id="incentive-contest-note" name="note" required minLength={5} maxLength={1000} disabled={contest.pending} placeholder="Ex.: venda de 12/11 não apareceu na minha contagem" /></Field>
        <Feedback result={contest.result} /><Button type="submit" loading={contest.pending}>Enviar contestação</Button>
      </form></SheetBody></SheetContent></Sheet>
    <Feedback result={contest.result} /></>;
}

export function IncentiveCampaignDetail({ data }: { data: DetailData }) {
  const { campaign, latest } = data;
  return <div className={page.stack}>
    <div className="flex flex-wrap items-center gap-2"><StatusBadge status={campaign.status} startsOn={campaign.startsOn} endsOn={campaign.endsOn} today={data.today} /><span className="text-sm text-muted-foreground">Versão {campaign.version} do regulamento</span></div>
    <CampaignActions data={data} />
    <section className={page.card} aria-labelledby="incentive-regulation"><h2 id="incentive-regulation" className={page.sectionTitle}>Regulamento</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt className={page.statLabel}>Métrica</dt><dd>{INCENTIVE_METRIC_LABELS[campaign.metric]}</dd></div>
        <div><dt className={page.statLabel}>Período</dt><dd>{day(campaign.startsOn)} a {day(campaign.endsOn)} (horário de Brasília)</dd></div>
        <div><dt className={page.statLabel}>Unidades</dt><dd>{campaign.branchNames.length ? campaign.branchNames.join(", ") : "Todas as unidades"}</dd></div>
        <div><dt className={page.statLabel}>Premiação</dt><dd>{campaign.prize || "Não informada"}</dd></div>
        <div><dt className={page.statLabel}>Exposição</dt><dd>{campaign.showNames ? "Nomes visíveis no ranking" : "Participantes veem apenas a própria posição identificada"}</dd></div>
        <div><dt className={page.statLabel}>Preparação e aprovação</dt><dd>{campaign.preparedBy}{campaign.approvedBy ? ` · aprovada por ${campaign.approvedBy}` : " · aguardando aprovação"}</dd></div>
      </dl>
      <p className="whitespace-pre-wrap text-sm">{campaign.regulation}</p>
      <p className="text-sm text-muted-foreground">Desempate: maior resultado; depois, quem atingiu o resultado primeiro (data do último fato válido); depois, ordem fixa de cadastro. Premiação não gera pagamento automático.</p>
      {campaign.status === "cancelled" ? <p className="text-sm">Motivo do cancelamento: {campaign.reason}</p> : null}
    </section>
    <section className={page.group} aria-labelledby="incentive-ranking"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="incentive-ranking" className={page.sectionTitle}>Ranking {latest ? `· apuração ${KIND_LABELS[latest.kind]?.toLowerCase() ?? latest.kind} de ${dateTime(latest.createdAt)}` : ""}</h2><Contest data={data} /></div>
      {latest ? latest.ranking.length ? <Table><TableHeader><TableRow><TableHead>Posição</TableHead><TableHead>Participante</TableHead><TableHead>{INCENTIVE_METRIC_LABELS[latest.metric]}</TableHead></TableRow></TableHeader>
        <TableBody>{latest.ranking.map((row) => <TableRow key={row.position} aria-current={row.isViewer ? "true" : undefined}><TableCell className={page.numeric}>{row.position}º</TableCell><TableCell>{row.isViewer ? <strong>{row.label}</strong> : row.label}</TableCell><TableCell className={page.numeric}>{formatValue(latest.metric, row.value)}</TableCell></TableRow>)}</TableBody></Table>
        : <div className={page.empty}><h3 className={page.emptyTitle}>Nenhum fato elegível</h3><p className={page.emptyText}>A apuração não encontrou vendas ou implantações válidas no período e nas unidades da campanha.</p></div>
        : <div className={page.empty}><h3 className={page.emptyTitle}>Sem apuração</h3><p className={page.emptyText}>{campaign.status === "draft" ? "A campanha precisa ser aprovada antes da primeira apuração." : "O ranking aparece depois da primeira apuração registrada."}</p></div>}
    </section>
    {data.history.length ? <section className={page.group} aria-labelledby="incentive-history"><h2 id="incentive-history" className={page.sectionTitle}>Histórico de apurações</h2>
      <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Versão</TableHead><TableHead>Responsável</TableHead><TableHead>Assinatura</TableHead></TableRow></TableHeader>
        <TableBody>{data.history.map((row) => <TableRow key={row.id}><TableCell>{dateTime(row.createdAt)}</TableCell><TableCell>{KIND_LABELS[row.kind] ?? row.kind}</TableCell><TableCell>{row.campaignVersion}</TableCell><TableCell>{row.createdBy}</TableCell><TableCell><code className="text-xs">{row.digest}</code></TableCell></TableRow>)}</TableBody></Table>
      <p className="text-sm text-muted-foreground">A assinatura se repete quando os mesmos fatos são apurados com a mesma versão do regulamento.</p></section> : null}
    {data.contestations.length ? <section className={page.group} aria-labelledby="incentive-contestations"><h2 id="incentive-contestations" className={page.sectionTitle}>{data.canManage ? "Contestações" : "Suas contestações"}</h2>
      <Table><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Participante</TableHead><TableHead>Posição</TableHead><TableHead>Nota</TableHead></TableRow></TableHeader>
        <TableBody>{data.contestations.map((row) => <TableRow key={row.id}><TableCell>{dateTime(row.createdAt)}</TableCell><TableCell>{row.author}</TableCell><TableCell>{row.position ? `${row.position}º` : "—"}</TableCell><TableCell className="whitespace-pre-wrap">{row.note}</TableCell></TableRow>)}</TableBody></Table></section> : null}
  </div>;
}
