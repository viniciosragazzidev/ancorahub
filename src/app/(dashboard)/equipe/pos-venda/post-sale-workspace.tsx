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
import { Pager, PostSaleResponses } from "./post-sale-responses";
import { PostSaleR0Settings } from "./post-sale-r0-settings";
import { PostSaleAutoRules } from "./post-sale-auto-rules";
import { postSaleRuleLabel, POST_SALE_RULE_FILTERS } from "@/features/post-sale-audit/auto-rules";

type WorkspaceData = Extract<Awaited<ReturnType<typeof getPostSaleWorkspaceAction>>, { ok: true }>['data'];
type AudienceKind = "broker" | "queue" | "period" | "leadIds";
type Preview = Awaited<ReturnType<typeof previewPostSaleAudienceAction>>;

function dayKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function PostSaleWorkspace({ initialData, initialAudience, initialPreview, initialFeedback }: {
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

  function refreshReport(periodDays: number, ruleFilter: string) {
    setFeedback("");
    startTransition(async () => {
      const refreshed = await getPostSaleWorkspaceAction(periodDays, ruleFilter);
      if (refreshed.ok) setData(refreshed.data);
      else setFeedback(refreshed.error);
    });
  }

  function changeReportPeriod(value: string) {
    const periodDays = Number(value);
    if (![7, 30, 90].includes(periodDays)) return;
    refreshReport(periodDays, data.ruleFilter);
  }

  function markAlertHandled(surveyId: string) {
    setFeedback("");
    startTransition(async () => {
      const result = await markPostSaleAlertHandledAction(surveyId);
      if (!result.ok) { setFeedback(result.error); return; }
      setFeedback(result.data.changed ? "Alerta marcado como tratado." : "Este alerta já foi tratado.");
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
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--text-secondary)]">Equipe</p>
            <h1 className="text-2xl font-semibold tracking-tight">Pós-venda</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">Acompanhe a experiência dos clientes e inicie uma pesquisa pelo mesmo número de WhatsApp.</p>
          </div>
          <span className="flex flex-wrap items-center gap-2">
            <a href="#respostas" className="rounded-full bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/15">Ver quem respondeu ({data.responses.length})</a>
            <a href="#regua-automatica" className="rounded-full bg-[var(--surface-secondary)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-foreground">Régua automática ({data.autoRules.rules.filter((rule) => rule.enabled).length} ligadas)</a>
          </span>
        </header>

        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div><CardTitle>Relatório por corretor</CardTitle><CardDescription>Pesquisas enviadas no período. Percentuais consideram apenas respostas válidas.</CardDescription></div>
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
          </CardHeader>
          <CardContent>
            {data.report.length ? <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead><tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Corretor</th><th className="px-2 py-2 font-medium">Enviadas</th><th className="px-2 py-2 font-medium">Respondidas</th><th className="px-2 py-2 font-medium">Foi atendido</th><th className="px-2 py-2 font-medium">Nota média</th><th className="px-2 py-2 font-medium">Fechou</th><th className="px-2 py-2 font-medium">Sem contato</th><th className="px-2 py-2 font-medium">Voltou sem resposta</th><th className="px-2 py-2 font-medium">Alertas abertos</th>
                </tr></thead>
                <tbody>{paginate([...data.report].sort((a, b) => b.responded - a.responded || b.sent - a.sent || a.brokerName.localeCompare(b.brokerName)), reportPage).items.map((row) => <tr key={row.brokerId} className="border-b border-border/60 last:border-0">
                  <th scope="row" className="px-2 py-3 font-medium"><BrokerProfileLink brokerId={row.brokerId} name={row.brokerName} /></th><td className="px-2 py-3 tabular-nums">{row.sent}</td><td className="px-2 py-3 tabular-nums">{row.responded}</td><td className="px-2 py-3">{row.attendancePercent === null ? "Sem respostas" : `${row.attendancePercent}%`}</td><td className="px-2 py-3">{row.averageRating === null ? "Sem notas" : `${row.averageRating}/5`}</td><td className="px-2 py-3">{row.closePercent === null ? "Sem respostas" : `${row.closePercent}%`}</td><td className="px-2 py-3 tabular-nums">{row.noContact}</td><td className="px-2 py-3 tabular-nums">{row.customerReturned}</td><td className="px-2 py-3 tabular-nums">{row.openAlerts}</td>
                </tr>)}</tbody>
              </table>
              <Pager page={paginate(data.report, reportPage).page} pages={paginate(data.report, reportPage).pages} onChange={setReportPage} label="corretores" />
            </div> : <p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">Nenhum corretor disponível no escopo atual.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alertas</CardTitle><CardDescription>Clientes que precisam de acompanhamento da direção ou da unidade.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {data.alerts.length ? data.alerts.map((alert) => <div key={alert.surveyId} className="flex flex-col gap-3 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0"><p className="font-medium">{alert.leadName}</p><p className="text-sm text-muted-foreground"><BrokerProfileLink brokerId={alert.brokerId} name={alert.brokerName} /> · {alert.reasons.map((reason) => POST_SALE_ALERT_REASON_LABELS[reason]).join("; ")}</p>{alert.lossDetail ? <p className="text-sm text-muted-foreground">{alert.lossDetail}</p> : null}<time className="text-xs text-muted-foreground" dateTime={alert.occurredAt}>{new Date(alert.occurredAt).toLocaleString("pt-BR")}</time></div>
              <div className="flex shrink-0 flex-wrap gap-2"><Button render={<Link href={`/leads/${encodeURIComponent(alert.leadId)}`} />} variant="outline" size="sm">Abrir lead</Button><Button type="button" variant="outline" size="sm" loading={busy} onClick={() => markAlertHandled(alert.surveyId)}>Marcar como tratado</Button></div>
            </div>) : <p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">Nenhum alerta aberto.</p>}
          </CardContent>
        </Card>

        <PostSaleR0Settings initial={data.r0} queues={data.queues} />

        <PostSaleAutoRules initial={data.autoRules} queues={data.queues} branches={data.branches} brokers={data.brokers} />

        <Card>
          <CardHeader>
            <CardTitle>Nova campanha</CardTitle>
            <CardDescription>Escolha um corretor, uma fila ou um período de chegada. A prévia mostra as exclusões antes do envio.</CardDescription>
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
              <span className="text-xs font-normal text-muted-foreground">Variáveis: {`{{nome}}, {{assistente}}, {{empresa}}, {{corretor}}`}. No canal Meta, enviamos o template aprovado pos_venda_apresentacao.</span>
            </label>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" size="lg" onClick={previewAudience} loading={busy}>Ver prévia</Button>
              <Button type="button" size="lg" onClick={dispatchCampaign} loading={busy} disabled={!preview?.ok || !preview.data.canStart}>Disparar campanha</Button>
            </div>
            {feedback ? <p className="text-sm text-[var(--text-secondary)]" role="status">{feedback}</p> : null}
            {preview?.ok ? <section className="grid gap-4 rounded-2xl border border-border bg-[var(--surface-secondary)] p-4" aria-label="Prévia da campanha">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><strong>{preview.data.totalEligible} elegíveis</strong><span>{preview.data.totalSelected} selecionados</span></div>
              <ul className="grid gap-1 text-sm text-muted-foreground">{Object.entries(preview.data.excluded).filter(([, count]) => count > 0).map(([reason, count]) => <li key={reason}>{count} fora: {POST_SALE_EXCLUSION_LABELS[reason as PostSaleExclusionReason] ?? reason.replaceAll("_", " ")}</li>)}</ul>
              <div className="grid gap-2 sm:grid-cols-3">{preview.data.examples.map((example) => <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm" key={example.leadId}>{example.name}<span className="ml-2 text-xs text-muted-foreground">{example.channelType === "meta" ? "Meta" : "WhatsApp"}</span></div>)}</div>
              {!preview.data.canStart ? <p className="text-sm text-destructive">{preview.data.totalEligible === 0 ? ((preview.data.excluded.template_unapproved ?? 0) > 0 ? "Nenhum lead pode receber agora. Os leads do número oficial esperam a Meta aprovar o template pos_venda_apresentacao." : "Nenhum lead pode receber agora. Ajuste o público.") : "Reduza o público para iniciar a campanha."}</p> : null}
            </section> : null}
            {preview && !preview.ok ? <p className="text-sm text-destructive" role="alert">{preview.error}</p> : null}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Campanhas recentes</CardTitle><CardDescription>Últimas campanhas criadas nesta empresa ou unidade.</CardDescription></CardHeader>
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

          <PostSaleResponses responses={data.responses} />
        </div>
      </div>
    </main>
  );
}
