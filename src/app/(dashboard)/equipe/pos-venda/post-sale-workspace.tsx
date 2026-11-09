"use client";

import { BrokerProfileLink } from "@/components/broker-profile-link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import litePage from "@/components/lite/page/lite-page.module.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createPostSaleCampaignAction,
  getPostSaleWorkspaceAction,
  markPostSaleAlertHandledAction,
  previewPostSaleAudienceAction,
  retryFailedPostSaleCampaignAction,
  startPostSaleCampaignAction,
} from "@/features/post-sale-audit/actions";
import { describePostSaleRetryResult } from "@/features/post-sale-audit/campaign-retry";
import { POST_SALE_EXCLUSION_LABELS, type PostSaleExclusionReason } from "@/features/post-sale-audit/rules";
import type { PostSaleAudience } from "@/features/post-sale-audit/rules";
import { POST_SALE_ALERT_REASON_LABELS } from "@/features/post-sale-audit/alert-rules";
import { POST_SALE_WAHA_OPENING_DEFAULT } from "@/features/post-sale-audit/template-contract";
import { paginate } from "@/features/post-sale-audit/responses-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { summarizePostSaleReport, type PostSaleBrokerReportRow } from "@/features/post-sale-audit/reporting";
import { R0_DEFAULTS } from "@/features/post-sale-audit/r0-rules";
import { Pager, PostSaleResponses } from "./post-sale-responses";
import { PostSaleR0Settings } from "./post-sale-r0-settings";
import { PostSaleAutoRules } from "./post-sale-auto-rules";
import { POST_SALE_TAB_LABELS, POST_SALE_TABS, postSaleTabHref, type PostSaleTab } from "./post-sale-tabs";
import { AUTO_RULE_LIMITS, postSaleRuleLabel, POST_SALE_RULE_FILTERS } from "@/features/post-sale-audit/auto-rules";

type WorkspaceData = Extract<Awaited<ReturnType<typeof getPostSaleWorkspaceAction>>, { ok: true }>['data'];
type AudienceKind = "broker" | "queue" | "period" | "leadIds";
type Preview = Awaited<ReturnType<typeof previewPostSaleAudienceAction>>;

function dayKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const REPORT_COLUMNS: LiteColumn<PostSaleBrokerReportRow>[] = [
  { id: "broker", label: "Corretor", primary: true, render: (row) => <BrokerProfileLink brokerId={row.brokerId} name={row.brokerName} /> },
  { id: "sent", label: "Enviadas", numeric: true, render: (row) => row.sent },
  { id: "responded", label: "Respondidas", numeric: true, render: (row) => row.responded },
  { id: "attendance", label: "Foi atendido", render: (row) => row.attendancePercent === null ? "Sem respostas" : `${row.attendancePercent}%` },
  { id: "rating", label: "Nota média", render: (row) => row.averageRating === null ? "Sem notas" : `${row.averageRating}/5` },
  { id: "closed", label: "Fechou", render: (row) => row.closePercent === null ? "Sem respostas" : `${row.closePercent}%` },
  { id: "noContact", label: "Sem contato", numeric: true, render: (row) => row.noContact },
  { id: "returned", label: "Voltou sem resposta", numeric: true, render: (row) => row.customerReturned },
  { id: "alerts", label: "Alertas abertos", numeric: true, render: (row) => row.openAlerts },
];

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card px-3 py-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function PostSaleWorkspace({ initialData, initialAudience, initialPreview, initialFeedback, initialTab = "visao-geral" }: {
  initialTab?: PostSaleTab;
  initialData: WorkspaceData;
  initialAudience?: PostSaleAudience;
  initialPreview?: Preview;
  initialFeedback?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [kind, setKind] = useState<AudienceKind>(initialAudience?.kind === "leadIds" ? "leadIds" : "broker");
  const [brokerId, setBrokerId] = useState("");
  const [queueId, setQueueId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState(`Pós-venda ${dayKey()}`);
  const [openingMessage, setOpeningMessage] = useState(POST_SALE_WAHA_OPENING_DEFAULT);
  const [preview, setPreview] = useState<Preview | null>(initialPreview ?? null);
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [overviewFeedback, setOverviewFeedback] = useState("");
  const [tab, setTab] = useState<PostSaleTab>(initialTab);
  const [reportPage, setReportPage] = useState(1);
  const [retryFeedback, setRetryFeedback] = useState<{ campaignId: string; text: string; error: boolean } | null>(null);
  const [busy, startTransition] = useTransition();

  const audience = useMemo(() => {
    if (kind === "leadIds") return initialAudience?.kind === "leadIds" ? initialAudience : null;
    const dates = { ...(from ? { arrivalFrom: from } : {}), ...(to ? { arrivalTo: to } : {}) };
    if (kind === "broker") return brokerId ? { kind: "broker" as const, brokerId, ...dates } : null;
    if (kind === "queue") return queueId ? { kind: "filters" as const, queueId, ...dates } : null;
    return { kind: "filters" as const, ...dates };
  }, [brokerId, from, initialAudience, kind, queueId, to]);

  const summary = useMemo(() => summarizePostSaleReport(data.report, data.alerts.length), [data.alerts.length, data.report]);
  const sortedReport = useMemo(() => [...data.report].sort((a, b) => b.responded - a.responded || b.sent - a.sent || a.brokerName.localeCompare(b.brokerName)), [data.report]);
  const reportView = paginate(sortedReport, reportPage);
  const enabledAutomations = data.autoRules.rules.filter((rule) => rule.enabled).length + (data.r0.enabled ? 1 : 0);

  /** Troca a aba sem recarregar a página e deixa a URL em `?aba=` (dá para voltar ou mandar o link). */
  function changeTab(value: string) {
    if (!(POST_SALE_TABS as readonly string[]).includes(value)) return;
    const next = value as PostSaleTab;
    setTab(next);
    window.history.replaceState(window.history.state, "", postSaleTabHref(window.location.search, next, window.location.pathname));
  }

  function refreshReport(periodDays: number, ruleFilter: string) {
    setOverviewFeedback("");
    startTransition(async () => {
      const refreshed = await getPostSaleWorkspaceAction(periodDays, ruleFilter);
      if (refreshed.ok) { setData(refreshed.data); setReportPage(1); }
      else setOverviewFeedback(refreshed.error);
    });
  }

  function changeReportPeriod(value: string) {
    const periodDays = Number(value);
    if (![7, 30, 90].includes(periodDays)) return;
    refreshReport(periodDays, data.ruleFilter);
  }

  function markAlertHandled(surveyId: string) {
    setOverviewFeedback("");
    startTransition(async () => {
      const result = await markPostSaleAlertHandledAction(surveyId);
      if (!result.ok) { setOverviewFeedback(result.error); return; }
      setOverviewFeedback(result.data.changed ? "Alerta marcado como tratado." : "Este alerta já foi tratado.");
      const refreshed = await getPostSaleWorkspaceAction(data.periodDays, data.ruleFilter);
      if (refreshed.ok) setData(refreshed.data);
    });
  }

  function retryFailed(campaign: WorkspaceData["campaigns"][number]) {
    const count = campaign.counts.retryable;
    if (!count) return;
    if (!window.confirm(`Reenviar ${count} ${count === 1 ? "pesquisa que falhou" : "pesquisas que falharam"} em "${campaign.name}"? As regras de hoje valem de novo (opt-out, 60 dias, conversa humana em 24 h, número errado).`)) return;
    setRetryFeedback(null);
    startTransition(async () => {
      const result = await retryFailedPostSaleCampaignAction(campaign.id);
      setRetryFeedback(result.ok
        ? { campaignId: campaign.id, text: describePostSaleRetryResult(result.data), error: false }
        : { campaignId: campaign.id, text: result.error, error: true });
      const refreshed = await getPostSaleWorkspaceAction(data.periodDays, data.ruleFilter);
      if (refreshed.ok) setData(refreshed.data);
    });
  }

  function previewAudience() {
    if (!audience) { setFeedback("Escolha um corretor ou uma fila."); return; }
    setFeedback("");
    startTransition(async () => {
      const result = await previewPostSaleAudienceAction(audience);
      setPreview(result);
      if (!result.ok) setFeedback(result.error);
    });
  }

  function dispatchCampaign() {
    if (!audience || !preview?.ok || !preview.data.canStart) return;
    setFeedback("");
    startTransition(async () => {
      const created = await createPostSaleCampaignAction({ name, audience, openingMessage });
      if (!created.ok) { setFeedback(created.error); return; }
      const started = await startPostSaleCampaignAction(created.data.id);
      if (!started.ok) { setFeedback(started.error); return; }
      setFeedback(`Campanha iniciada. ${started.data.queued} mensagens na fila, ${started.data.skipped} ignoradas e ${started.data.failed} falhas.`);
      const refreshed = await getPostSaleWorkspaceAction(data.periodDays, data.ruleFilter);
      if (refreshed.ok) setData(refreshed.data);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <main className="arc-venancor mx-auto w-full max-w-6xl px-4 py-6 sm:px-6" data-slot="post-sale-page">
      <div className={litePage.stack}>
        <header className="space-y-1">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Equipe</p>
          <h1 className="text-2xl font-semibold tracking-tight">Pós-venda</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Experiência dos clientes, pesquisas pelo mesmo número de WhatsApp e automações.</p>
        </header>

        <Tabs value={tab} onValueChange={changeTab} variant="segment" className="min-w-0 gap-4">
          <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList aria-label="Seções do pós-venda" className="w-max">
              <TabsTrigger value="visao-geral">{POST_SALE_TAB_LABELS["visao-geral"]}</TabsTrigger>
              <TabsTrigger value="respostas">{POST_SALE_TAB_LABELS.respostas}<span className="text-xs tabular-nums text-muted-foreground">{data.responses.length}</span></TabsTrigger>
              <TabsTrigger value="campanhas">{POST_SALE_TAB_LABELS.campanhas}</TabsTrigger>
              <TabsTrigger value="automacoes">{POST_SALE_TAB_LABELS.automacoes}<span className="text-xs tabular-nums text-muted-foreground">{enabledAutomations} {enabledAutomations === 1 ? "ligada" : "ligadas"}</span></TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="visao-geral" className="grid min-w-0 gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm text-muted-foreground">Pesquisas enviadas nos últimos {data.periodDays} dias{data.ruleFilter === "all" ? "" : ` · ${data.ruleFilter === "manual" ? "Manual" : postSaleRuleLabel(data.ruleFilter)}`}.</p>
              <span className="flex flex-wrap gap-3">
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">Origem
                  <AppSelect aria-label="Origem das pesquisas do relatório" value={data.ruleFilter} onValueChange={(value) => refreshReport(data.periodDays, value)} options={POST_SALE_RULE_FILTERS.map((key) => ({ value: key, label: key === "all" ? "Todas" : postSaleRuleLabel(key === "manual" ? null : key) }))} />
                </label>
                <label className="grid gap-1 text-xs font-medium text-muted-foreground">Período
                  <AppSelect aria-label="Período do relatório" value={String(data.periodDays)} onValueChange={changeReportPeriod} options={[
                    { value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" },
                  ]} />
                </label>
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Resumo do período">
              <Kpi label="Enviadas" value={String(summary.sent)} />
              <Kpi label="Responderam" value={String(summary.responded)} />
              <Kpi label="% atendido" value={summary.attendancePercent === null ? "Sem dados" : `${summary.attendancePercent}%`} />
              <Kpi label="Nota média" value={summary.averageRating === null ? "Sem notas" : `${summary.averageRating}/5`} />
              <Kpi label="Alertas abertos" value={String(summary.openAlerts)} />
            </dl>
            {overviewFeedback ? <p className="text-sm text-[var(--text-secondary)]" role="status">{overviewFeedback}</p> : null}

            <Card>
              <CardHeader><CardTitle>Alertas abertos</CardTitle><CardDescription>Clientes que precisam de acompanhamento da direção ou da unidade.</CardDescription></CardHeader>
              <CardContent className="grid gap-3">
                {data.alerts.length ? data.alerts.map((alert) => <div key={alert.surveyId} className="flex flex-col gap-3 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0"><p className="font-medium">{alert.leadName}</p><p className="text-sm text-muted-foreground"><BrokerProfileLink brokerId={alert.brokerId} name={alert.brokerName} /> · {alert.reasons.map((reason) => POST_SALE_ALERT_REASON_LABELS[reason]).join("; ")}</p>{alert.detail ? <p className="break-words text-sm text-muted-foreground">{alert.detail}</p> : null}<time className="text-xs text-muted-foreground" dateTime={alert.occurredAt}>{new Date(alert.occurredAt).toLocaleString("pt-BR")}</time></div>
                  <div className="flex shrink-0 flex-wrap gap-2"><Button render={<Link href={`/leads/${encodeURIComponent(alert.leadId)}`} />} variant="outline" size="sm">Abrir lead</Button><Button type="button" variant="outline" size="sm" loading={busy} onClick={() => markAlertHandled(alert.surveyId)}>Marcar como tratado</Button></div>
                </div>) : <p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">Nenhum alerta aberto.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Relatório por corretor</CardTitle><CardDescription>Percentuais consideram apenas respostas válidas.</CardDescription></CardHeader>
              <CardContent className="min-w-0">
                <LiteResponsiveData
                  caption="Relatório de pós-venda por corretor"
                  columns={REPORT_COLUMNS}
                  rows={reportView.items}
                  rowKey={(row) => row.brokerId}
                  empty={<p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">Nenhum corretor disponível no escopo atual.</p>}
                />
                <Pager page={reportView.page} pages={reportView.pages} onChange={setReportPage} label="corretores" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="respostas" className="min-w-0">
            <PostSaleResponses responses={data.responses} />
          </TabsContent>

          <TabsContent value="campanhas" className="grid min-w-0 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Nova campanha</CardTitle>
                <CardDescription>Escolha o público e veja a prévia com as exclusões antes de disparar.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">Público
                    <AppSelect aria-label="Tipo de público" value={kind} onValueChange={(value) => setKind(value as AudienceKind)} options={[
                      { value: "broker", label: "Por corretor" }, { value: "queue", label: "Por fila" }, { value: "period", label: "Por período de chegada" }, ...(initialAudience?.kind === "leadIds" ? [{ value: "leadIds", label: "Leads selecionados" }] : []),
                    ]} />
                  </label>
                  {kind === "leadIds" && initialAudience?.kind === "leadIds" ? <p className="self-end text-sm text-muted-foreground">{initialAudience.leadIds.length} leads selecionados na lista.</p> : null}
                  {kind === "broker" ? <label className="grid gap-2 text-sm font-medium">Corretor
                    <AppSelect aria-label="Corretor" value={brokerId} onValueChange={setBrokerId} placeholder="Selecione o corretor" options={data.brokers.map((broker) => ({ value: broker.id, label: broker.name }))} />
                  </label> : null}
                  {kind === "queue" ? <label className="grid gap-2 text-sm font-medium">Fila
                    <AppSelect aria-label="Fila" value={queueId} onValueChange={setQueueId} placeholder="Selecione a fila" options={data.queues.map((queue) => ({ value: queue.id, label: queue.name }))} />
                  </label> : null}
                  <label className="grid gap-2 text-sm font-medium">Chegada a partir de <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
                  <label className="grid gap-2 text-sm font-medium">Chegada até <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
                  <label className="grid gap-2 text-sm font-medium">Nome da campanha <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
                </div>
                <label className="grid gap-2 text-sm font-medium">Texto inicial do WhatsApp via WAHA
                  <Textarea value={openingMessage} onChange={(event) => setOpeningMessage(event.target.value)} rows={4} maxLength={4096} />
                  <span className="text-xs font-normal text-muted-foreground">Variáveis: {`{{nome}}, {{assistente}}, {{empresa}}, {{corretor}}`}. No canal Meta sai o template aprovado pos_venda_apresentacao.</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" size="lg" onClick={previewAudience} loading={busy}>Ver prévia</Button>
                  <Button type="button" size="lg" onClick={dispatchCampaign} loading={busy} disabled={!preview?.ok || !preview.data.canStart}>Disparar campanha</Button>
                </div>
                {feedback ? <p className="text-sm text-[var(--text-secondary)]" role="status">{feedback}</p> : null}
                {preview?.ok ? <section className="grid gap-4 rounded-2xl border border-border bg-[var(--surface-secondary)] p-4" aria-label="Prévia da campanha">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><strong>{preview.data.totalEligible} elegíveis</strong><span>{preview.data.totalSelected} selecionados</span></div>
                  <ul className="grid gap-1 text-sm text-muted-foreground">{Object.entries(preview.data.excluded).filter(([, count]) => count > 0).map(([reason, count]) => <li key={reason}>{count} fora: {POST_SALE_EXCLUSION_LABELS[reason as PostSaleExclusionReason] ?? reason.replaceAll("_", " ")}</li>)}</ul>
                  <div className="grid gap-2 sm:grid-cols-3">{preview.data.examples.map((example) => <div className="min-w-0 truncate rounded-xl border border-border bg-card px-3 py-2 text-sm" key={example.leadId}>{example.name}<span className="ml-2 text-xs text-muted-foreground">{example.channelType === "meta" ? "Meta" : "WhatsApp"}</span></div>)}</div>
                  {!preview.data.canStart ? <p className="text-sm text-destructive">{preview.data.totalEligible === 0 ? ((preview.data.excluded.template_unapproved ?? 0) > 0 ? "Nenhum lead pode receber agora. Os leads do número oficial esperam a Meta aprovar o template pos_venda_apresentacao." : "Nenhum lead pode receber agora. Ajuste o público.") : "Reduza o público para iniciar a campanha."}</p> : null}
                </section> : null}
                {preview && !preview.ok ? <p className="text-sm text-destructive" role="alert">{preview.error}</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Campanhas recentes</CardTitle><CardDescription>Últimas campanhas desta empresa ou unidade.</CardDescription></CardHeader>
              <CardContent className="grid gap-3">
                {data.campaigns.length ? data.campaigns.map((campaign) => <div key={campaign.id} className="grid gap-2 rounded-xl border border-border px-3 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{campaign.name}</p><p className="text-xs text-muted-foreground">{new Date(campaign.createdAt).toLocaleDateString("pt-BR")} · {postSaleRuleLabel(campaign.ruleKey)} · {campaign.status}</p></div>
                    {campaign.counts.queued ? <span className="shrink-0 text-xs text-muted-foreground">{campaign.counts.queued} na fila</span> : null}
                  </div>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
                    <span>{campaign.counts.sent} enviadas</span><span>{campaign.counts.failed} falharam</span><span>{campaign.counts.skipped} puladas</span>
                  </p>
                  {campaign.ruleKey === null && campaign.status !== "draft" && campaign.counts.retryable > 0 ? <div>
                    <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => retryFailed(campaign)}>Reenviar as que falharam ({campaign.counts.retryable})</Button>
                  </div> : null}
                  {retryFeedback?.campaignId === campaign.id ? <p className={retryFeedback.error ? "text-xs text-destructive" : "text-xs text-[var(--text-secondary)]"} role={retryFeedback.error ? "alert" : "status"}>{retryFeedback.text}</p> : null}
                </div>) : <p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">Nenhuma campanha foi criada ainda.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automacoes" className="grid min-w-0 gap-3">
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">A equipe de qualidade conversa sozinha com o cliente pelo mesmo número. A chave salva na hora; &quot;Ajustar&quot; abre os detalhes.</p>
              <details className="rounded-2xl border border-border px-4 py-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer text-sm font-medium text-foreground">Como funciona</summary>
                <div className="mt-2 grid gap-2">
                  <p>Régua R1 a R5: sai alguns dias úteis depois de cada marco (seg a sex, 8h às 18h). No número oficial sai o template aprovado pos_venda_apresentacao. Tudo começa desligado. O piloto é opcional: sem piloto, a regra vale para todas as filas, até {AUTO_RULE_LIMITS.dailyLimit} por dia; em piloto, até {AUTO_RULE_LIMITS.pilotDailyLimit} por dia.</p>
                  <p>Proteções da régua: no máximo 1 conversa de pós-venda por cliente a cada {AUTO_RULE_LIMITS.cooldownDays} dias (manual e automática somadas), nada se houve conversa humana nas últimas 24 h, se o cliente pediu para parar, se o número é inválido ou se o lead é de um diretor. Até {AUTO_RULE_LIMITS.tenantDailyLimit} conversas por dia na empresa.</p>
                  <p>Proteções da R0: no máximo 1 conversa por cliente a cada {R0_DEFAULTS.cooldownDays} dias, nada se o corretor respondeu nas últimas {R0_DEFAULTS.brokerRecentReplyHours} h, se há pesquisa em andamento, se o cliente pediu para parar ou se o lead é de um diretor.</p>
                  <p>A IA nunca informa preço e o corretor não vê nada na linha do tempo.</p>
                </div>
              </details>
            </div>
            <PostSaleR0Settings initial={data.r0} queues={data.queues} onSaved={(r0) => setData((current) => ({ ...current, r0: { ...current.r0, ...r0 } }))} />
            <PostSaleAutoRules initial={data.autoRules} queues={data.queues} branches={data.branches} brokers={data.brokers} onSaved={(rule) => setData((current) => ({ ...current, autoRules: { ...current.autoRules, rules: current.autoRules.rules.map((item) => item.key === rule.key ? rule : item) } }))} />
            {!data.r0.canEdit ? <p className="text-xs text-muted-foreground">Só a direção pode alterar as automações.</p> : null}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
