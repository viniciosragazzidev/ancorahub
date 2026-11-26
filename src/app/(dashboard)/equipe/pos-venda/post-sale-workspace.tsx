"use client";

/**
 * Equipe › Pós-venda no Lite (24/11): Visão geral (números, funil, regra, dia, alertas), Corretores (tabela +
 * painel com os leads), Leads (lista filtrável com a conversa no painel), Campanhas e Automações (com "O que sai
 * hoje"). Tudo sai de uma lista de pesquisas do período; os filtros não voltam ao servidor.
 */
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LiteActionButton, LiteMenu, LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPostSaleCampaignAction,
  duplicatePostSaleCampaignAction,
  getPostSaleWorkspaceAction,
  previewPostSaleAudienceAction,
  retryFailedPostSaleCampaignAction,
  sendPostSaleTestAction,
  startPostSaleCampaignAction,
} from "@/features/post-sale-audit/actions";
import { AUTO_RULE_LIMITS, postSaleRuleLabel } from "@/features/post-sale-audit/auto-rules";
import { describePostSaleRetryResult } from "@/features/post-sale-audit/campaign-retry";
import { POST_SALE_TEST_HOURLY_LIMIT, postSaleAudienceToForm } from "@/features/post-sale-audit/campaign-test";
import {
  EMPTY_POST_SALE_FILTERS,
  postSaleByBroker,
  postSaleByDay,
  postSaleByRule,
  summarizePostSaleSurveys,
  type BrokerBreakdown,
  type PostSaleListFilters,
  type PostSaleSurveyRow,
} from "@/features/post-sale-audit/overview";
import { R0_DEFAULTS } from "@/features/post-sale-audit/r0-rules";
import { POST_SALE_EXCLUSION_LABELS, type PostSaleAudience, type PostSaleExclusionReason } from "@/features/post-sale-audit/rules";
import { POST_SALE_WAHA_OPENING_DEFAULT } from "@/features/post-sale-audit/template-contract";

import { PostSaleAutoRules } from "./post-sale-auto-rules";
import { PostSaleBrokerPanel, PostSaleBrokers } from "./post-sale-brokers";
import { PostSaleLeadPanel } from "./post-sale-lead-panel";
import { PostSaleLeads } from "./post-sale-leads";
import { PostSaleOverview } from "./post-sale-overview";
import { PostSaleR0Settings } from "./post-sale-r0-settings";
import { PostSaleToday } from "./post-sale-today";
import { POST_SALE_TAB_LABELS, POST_SALE_TABS, postSaleTabHref, type PostSaleTab } from "./post-sale-tabs";
import styles from "./post-sale.module.css";

type WorkspaceData = Extract<Awaited<ReturnType<typeof getPostSaleWorkspaceAction>>, { ok: true }>["data"];
type AudienceKind = "broker" | "queue" | "period" | "leadIds";
type Preview = Awaited<ReturnType<typeof previewPostSaleAudienceAction>>;
type Panel = { kind: "broker"; broker: BrokerBreakdown } | { kind: "lead"; row: PostSaleSurveyRow; from?: BrokerBreakdown } | null;

function dayKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

const count = "text-xs tabular-nums text-muted-foreground";

export function PostSaleWorkspace({ initialData, initialAudience, initialPreview, initialFeedback, initialTab = "visao-geral", initialRespondedOnly = false }: {
  initialTab?: PostSaleTab;
  initialData: WorkspaceData;
  initialAudience?: PostSaleAudience;
  initialPreview?: Preview;
  initialFeedback?: string;
  /** Link antigo `?aba=respostas`: abre Leads só com quem respondeu. */
  initialRespondedOnly?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<PostSaleTab>(initialTab);
  const [filters, setFilters] = useState<PostSaleListFilters>(initialRespondedOnly ? { ...EMPTY_POST_SALE_FILTERS, stage: "responded" } : EMPTY_POST_SALE_FILTERS);
  const [panel, setPanel] = useState<Panel>(null);
  const [periodError, setPeriodError] = useState("");
  const [busy, startTransition] = useTransition();

  const surveys = data.surveys;
  const summary = useMemo(() => summarizePostSaleSurveys(surveys), [surveys]);
  const rules = useMemo(() => postSaleByRule(surveys), [surveys]);
  const days = useMemo(() => postSaleByDay(surveys, data.periodDays), [surveys, data.periodDays]);
  const brokers = useMemo(() => postSaleByBroker(surveys), [surveys]);
  const enabledAutomations = data.autoRules.rules.filter((rule) => rule.enabled).length + (data.r0.enabled ? 1 : 0);

  /** Troca a aba sem recarregar a página e deixa a URL em `?aba=` (dá para voltar ou mandar o link). */
  function changeTab(value: string) {
    if (!(POST_SALE_TABS as readonly string[]).includes(value)) return;
    const next = value as PostSaleTab;
    setTab(next);
    window.history.replaceState(window.history.state, "", postSaleTabHref(window.location.search, next, window.location.pathname));
  }

  function showLeads(patch: Partial<PostSaleListFilters>) {
    setFilters({ ...EMPTY_POST_SALE_FILTERS, ...patch });
    changeTab("leads");
  }

  async function refresh(periodDays = data.periodDays) {
    const refreshed = await getPostSaleWorkspaceAction(periodDays);
    if (refreshed.ok) setData(refreshed.data);
    return refreshed;
  }

  function changePeriod(value: string) {
    const periodDays = Number(value);
    if (![7, 30, 90].includes(periodDays) || periodDays === data.periodDays) return;
    setPeriodError("");
    startTransition(async () => {
      const refreshed = await refresh(periodDays);
      if (!refreshed.ok) { setPeriodError(`${refreshed.error} O período anterior continua na tela.`); return; }
      setFilters((current) => ({ ...current, day: "" }));
      // O período fica na URL (?period=): recarregar mantém o mesmo relatório.
      const params = new URLSearchParams(window.location.search);
      params.set("period", String(periodDays));
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
    });
  }

  const brokerRows = panel?.kind === "broker" ? surveys.filter((row) => (row.brokerId ?? "sem-corretor") === panel.broker.brokerId) : [];
  const panelTitle = panel?.kind === "broker" ? panel.broker.brokerName : panel?.kind === "lead" ? panel.row.leadName : "";
  const panelDescription = panel?.kind === "broker"
    ? `${panel.broker.leads.toLocaleString("pt-BR")} ${panel.broker.leads === 1 ? "lead" : "leads"} em pós-venda nos últimos ${data.periodDays} dias`
    : panel?.kind === "lead" ? `${panel.row.brokerName ?? "Sem corretor"} · ${postSaleRuleLabel(panel.row.ruleKey)}` : undefined;
  const showPeriod = tab !== "campanhas" && tab !== "automacoes";

  return (
    <div className={`arc-venancor ${page.stack}`} data-slot="post-sale-page">
      <Tabs value={tab} onValueChange={changeTab} variant="segment" className="min-w-0 gap-4">
        <div className={styles.cardHeadRow}>
          <div className="-mx-1 min-w-0 max-w-full overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList aria-label="Seções do pós-venda" className="w-max">
              <TabsTrigger value="visao-geral">{POST_SALE_TAB_LABELS["visao-geral"]}</TabsTrigger>
              <TabsTrigger value="corretores">{POST_SALE_TAB_LABELS.corretores}<span className={count}>{brokers.length}</span></TabsTrigger>
              <TabsTrigger value="leads">{POST_SALE_TAB_LABELS.leads}<span className={count}>{surveys.length}</span></TabsTrigger>
              <TabsTrigger value="campanhas">{POST_SALE_TAB_LABELS.campanhas}</TabsTrigger>
              <TabsTrigger value="automacoes">{POST_SALE_TAB_LABELS.automacoes}<span className={count}>{enabledAutomations} {enabledAutomations === 1 ? "ligada" : "ligadas"}</span></TabsTrigger>
            </TabsList>
          </div>
          {showPeriod ? (
            <div className={page.selectNarrow}>
              <LiteSelect label="Período" hideLabel value={String(data.periodDays)} onChange={changePeriod} options={[{ value: "7", label: "7 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "90 dias" }]} />
            </div>
          ) : null}
        </div>
        {busy && showPeriod ? <p className={page.muted} role="status">Atualizando o período…</p> : null}
        {periodError ? <p className={page.muted} role="alert">{periodError}</p> : null}

        <TabsContent value="visao-geral" className="min-w-0">
          <PostSaleOverview
            summary={summary}
            rules={rules}
            days={days}
            alerts={data.alerts}
            periodDays={data.periodDays}
            onFilter={showLeads}
            onAlertHandled={async () => { await refresh(); }}
          />
        </TabsContent>

        <TabsContent value="corretores" className="min-w-0">
          <PostSaleBrokers brokers={brokers} onOpen={(broker) => setPanel({ kind: "broker", broker })} />
        </TabsContent>

        <TabsContent value="leads" className="min-w-0">
          <PostSaleLeads rows={surveys} filters={filters} onFiltersChange={setFilters} onOpen={(row) => setPanel({ kind: "lead", row })} periodDays={data.periodDays} />
        </TabsContent>

        <TabsContent value="campanhas" className="min-w-0">
          <PostSaleCampaigns data={data} initialAudience={initialAudience} initialPreview={initialPreview} initialFeedback={initialFeedback} onChanged={async () => { await refresh(); router.refresh(); }} />
        </TabsContent>

        <TabsContent value="automacoes" className="grid min-w-0 gap-4">
          <PostSaleToday canForce={data.r0.canEdit} />
          <details className={page.card}>
            <summary className={page.cellTitle} style={{ cursor: "pointer" }}>Como funciona a régua</summary>
            <div className="grid gap-2 text-sm text-[var(--text-secondary)]">
              <p>Régua R1 a R5: sai alguns dias úteis depois de cada marco (seg a sex, 8h às 18h). No número oficial sai o template aprovado pos_venda_apresentacao. O piloto é opcional: sem piloto, a regra vale para todas as filas, até o limite dela por dia; em piloto, até {AUTO_RULE_LIMITS.pilotDailyLimit} por dia.</p>
              <p>Proteções da régua: no máximo 1 conversa de pós-venda por cliente a cada {AUTO_RULE_LIMITS.cooldownDays} dias (manual e automática somadas), nada se houve conversa humana nas últimas 24 h, se o cliente pediu para parar, se o número é inválido ou se o lead é de um diretor. Até {data.autoRules.tenantDailyLimit} conversas por dia na empresa, divididas entre as regras ligadas: cada uma ganha uma parte igual e o que uma não usa vai para as outras.</p>
              <p>Proteções da R0: no máximo 1 conversa por cliente a cada {R0_DEFAULTS.cooldownDays} dias, nada se o corretor respondeu nas últimas {R0_DEFAULTS.brokerRecentReplyHours} h, se há pesquisa em andamento, se o cliente pediu para parar ou se o lead é de um diretor.</p>
              <p>A IA nunca informa preço e o corretor não vê nada na linha do tempo.</p>
            </div>
          </details>
          <PostSaleR0Settings initial={data.r0} queues={data.queues} onSaved={(r0) => setData((current) => ({ ...current, r0: { ...current.r0, ...r0 } }))} />
          <PostSaleAutoRules initial={data.autoRules} queues={data.queues} branches={data.branches} brokers={data.brokers} onSaved={(rule) => setData((current) => ({ ...current, autoRules: { ...current.autoRules, rules: current.autoRules.rules.map((item) => item.key === rule.key ? rule : item) } }))} />
          {!data.r0.canEdit ? <p className={page.muted}>Só a direção pode alterar as automações.</p> : null}
        </TabsContent>
      </Tabs>

      <LiteSidePanel open={panel !== null} onOpenChange={(open) => { if (!open) setPanel(null); }} title={panelTitle} description={panelDescription}>
        {panel?.kind === "broker" ? <PostSaleBrokerPanel broker={panel.broker} rows={brokerRows} onOpenLead={(row) => setPanel({ kind: "lead", row, from: panel.broker })} /> : null}
        {panel?.kind === "lead" ? (
          <div className={styles.panel}>
            {panel.from ? <button type="button" className={page.cellLink} style={{ justifySelf: "start" }} onClick={() => setPanel({ kind: "broker", broker: panel.from! })}>Voltar para {panel.from.brokerName}</button> : null}
            <PostSaleLeadPanel key={panel.row.id} row={panel.row} />
          </div>
        ) : null}
      </LiteSidePanel>
    </div>
  );
}

/** Campanha manual (público, prévia com exclusões, disparo) e campanhas recentes com "Reenviar as que falharam". */
function PostSaleCampaigns({ data, initialAudience, initialPreview, initialFeedback, onChanged }: {
  data: WorkspaceData;
  initialAudience?: PostSaleAudience;
  initialPreview?: Preview;
  initialFeedback?: string;
  onChanged: () => Promise<void>;
}) {
  const [kind, setKind] = useState<AudienceKind>(initialAudience?.kind === "leadIds" ? "leadIds" : "broker");
  const [brokerId, setBrokerId] = useState("");
  const [queueId, setQueueId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [name, setName] = useState(`Pós-venda ${dayKey()}`);
  const [openingMessage, setOpeningMessage] = useState(POST_SALE_WAHA_OPENING_DEFAULT);
  const [preview, setPreview] = useState<Preview | null>(initialPreview ?? null);
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [retryFeedback, setRetryFeedback] = useState<{ campaignId: string; text: string; error: boolean } | null>(null);
  // "Duplicar" (26/11): o rascunho copiado e o público salvo dele, usado enquanto ninguém mexe no público.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftAudience, setDraftAudience] = useState<PostSaleAudience | null>(null);
  const [leadIdsAudience, setLeadIdsAudience] = useState<PostSaleAudience | null>(initialAudience?.kind === "leadIds" ? initialAudience : null);
  const [testNote, setTestNote] = useState("");
  const formRef = useRef<HTMLElement>(null);
  const [busy, startTransition] = useTransition();

  /** Mexer no público solta o público copiado: vale o que está no formulário. */
  function audienceChanged<T>(set: (value: T) => void) {
    return (value: T) => { setDraftAudience(null); setPreview(null); set(value); };
  }

  const audience = useMemo(() => {
    if (draftAudience) return draftAudience;
    if (kind === "leadIds") return leadIdsAudience;
    const dates = { ...(from ? { arrivalFrom: from } : {}), ...(to ? { arrivalTo: to } : {}) };
    if (kind === "broker") return brokerId ? { kind: "broker" as const, brokerId, ...dates } : null;
    if (kind === "queue") return queueId ? { kind: "filters" as const, queueId, ...dates } : null;
    return { kind: "filters" as const, ...dates };
  }, [brokerId, draftAudience, from, kind, leadIdsAudience, queueId, to]);

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
      const created = await createPostSaleCampaignAction({ name, audience, openingMessage, ...(draftId ? { draftId } : {}) });
      if (!created.ok) { setFeedback(created.error); return; }
      const started = await startPostSaleCampaignAction(created.data.id);
      if (!started.ok) { setFeedback(started.error); return; }
      setFeedback(`Campanha iniciada. ${started.data.queued} mensagens na fila, ${started.data.skipped} ignoradas e ${started.data.failed} falhas.`);
      setPreview(null);
      setDraftId(null);
      setDraftAudience(null);
      await onChanged();
    });
  }

  async function sendTest() {
    if (!audience) return { ok: false as const, error: "Escolha um corretor ou uma fila." };
    setTestNote("");
    const result = await sendPostSaleTestAction({ audience, openingMessage });
    if (!result.ok) return result;
    const left = result.data.remaining;
    const channel = result.data.channelType === "meta" ? "canal Meta" : "WhatsApp";
    setTestNote(`Teste enviado para o seu celular com os dados de ${result.data.exampleName}, pelo ${channel} do disparo. ${left === 0 ? "O próximo teste libera em até 1 hora." : `Ainda dá para mandar ${left} nesta hora.`}`);
    return { ok: true as const };
  }

  function duplicate(campaign: WorkspaceData["campaigns"][number]) {
    setFeedback("");
    startTransition(async () => {
      const result = await duplicatePostSaleCampaignAction(campaign.id);
      if (!result.ok) { setFeedback(`${result.error} Nada foi copiado.`); return; }
      const values = postSaleAudienceToForm(result.data.audience);
      setKind(values.kind);
      setBrokerId(values.kind === "broker" ? values.brokerId : "");
      setQueueId(values.kind === "queue" ? values.queueId : "");
      setFrom(values.kind === "leadIds" ? "" : values.from);
      setTo(values.kind === "leadIds" ? "" : values.to);
      if (values.kind === "leadIds") setLeadIdsAudience({ kind: "leadIds", leadIds: values.leadIds });
      setName(result.data.name);
      setOpeningMessage(result.data.openingMessage);
      setDraftId(result.data.id);
      setDraftAudience(result.data.audience);
      setPreview(null);
      setTestNote("");
      setFeedback(`Rascunho "${result.data.name}" criado com o mesmo público e texto. Revise, veja a prévia e dispare.`);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      await onChanged();
    });
  }

  function retryFailed(campaign: WorkspaceData["campaigns"][number]) {
    const retryable = campaign.counts.retryable;
    if (!retryable) return;
    if (!window.confirm(`Reenviar ${retryable} ${retryable === 1 ? "pesquisa que falhou" : "pesquisas que falharam"} em "${campaign.name}"? As regras de hoje valem de novo (opt-out, 60 dias, conversa humana em 24 h, número errado).`)) return;
    setRetryFeedback(null);
    startTransition(async () => {
      const result = await retryFailedPostSaleCampaignAction(campaign.id);
      setRetryFeedback(result.ok
        ? { campaignId: campaign.id, text: describePostSaleRetryResult(result.data), error: false }
        : { campaignId: campaign.id, text: result.error, error: true });
      await onChanged();
    });
  }

  return (
    <div className={page.stack}>
      <section ref={formRef} className={page.card} aria-labelledby="pos-venda-nova-campanha">
        <div className={page.cardHead}>
          <h2 id="pos-venda-nova-campanha" className={page.cardTitle}>Nova campanha</h2>
          <p className={page.cardDescription}>Escolha o público e veja a prévia com as exclusões antes de disparar.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <LiteSelect label="Público" value={kind} onChange={audienceChanged((value: string) => setKind(value as AudienceKind))} options={[
            { value: "broker", label: "Por corretor" }, { value: "queue", label: "Por fila" }, { value: "period", label: "Por período de chegada" }, ...(leadIdsAudience?.kind === "leadIds" ? [{ value: "leadIds", label: "Leads selecionados" }] : []),
          ]} />
          {kind === "leadIds" && leadIdsAudience?.kind === "leadIds" ? <p className={`${page.muted} self-end`}>{leadIdsAudience.leadIds.length} leads selecionados.</p> : null}
          {kind === "broker" ? <LiteSelect label="Corretor" value={brokerId} onChange={audienceChanged(setBrokerId)} placeholder="Selecione o corretor" options={data.brokers.map((broker) => ({ value: broker.id, label: broker.name }))} /> : null}
          {kind === "queue" ? <LiteSelect label="Fila" value={queueId} onChange={audienceChanged(setQueueId)} placeholder="Selecione a fila" options={data.queues.map((queue) => ({ value: queue.id, label: queue.name }))} /> : null}
          <label className={form.field}><span className={form.label}>Chegada a partir de</span><input className={form.input} type="date" value={from} onChange={(event) => audienceChanged(setFrom)(event.target.value)} /></label>
          <label className={form.field}><span className={form.label}>Chegada até</span><input className={form.input} type="date" value={to} onChange={(event) => audienceChanged(setTo)(event.target.value)} /></label>
          <label className={form.field}><span className={form.label}>Nome da campanha</span><input className={form.input} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} /></label>
        </div>
        <label className={form.field}>
          <span className={form.label}>Texto inicial do WhatsApp via WAHA</span>
          <textarea className={form.textarea} value={openingMessage} onChange={(event) => setOpeningMessage(event.target.value)} rows={4} maxLength={4096} />
          <span className={form.hint}>Variáveis: {"{{nome}}, {{assistente}}, {{empresa}}, {{corretor}}"}. No canal Meta sai o template aprovado pos_venda_apresentacao.</span>
        </label>
        <div className={styles.actions}>
          <button type="button" className={page.button} onClick={previewAudience} disabled={busy}>{busy ? "Calculando…" : "Ver prévia"}</button>
          <LiteActionButton
            tone="secondary"
            busyLabel="Enviando teste…"
            doneLabel="Teste enviado"
            keeps="A campanha não foi disparada."
            errorFallback="Não deu para enviar o teste agora."
            disabled={busy || !audience}
            onAction={sendTest}
          >
            Enviar teste para mim
          </LiteActionButton>
          <button type="button" className={page.primaryButton} onClick={dispatchCampaign} disabled={busy || !preview?.ok || !preview.data.canStart}>Disparar campanha</button>
        </div>
        <span className={form.hint}>O teste vai para o celular do seu perfil, com os dados de um cliente do público e pelo mesmo canal do disparo. Até {POST_SALE_TEST_HOURLY_LIMIT} por hora.</span>
        {testNote ? <p className={page.muted} role="status">{testNote}</p> : null}
        {feedback ? <p className={page.muted} role="status">{feedback}</p> : null}
        {preview?.ok ? (
          <section className={page.group} aria-label="Prévia da campanha">
            <p className={page.cellTitle}>{preview.data.totalEligible} elegíveis de {preview.data.totalSelected} selecionados</p>
            <ul className="grid gap-1 text-sm text-[var(--text-secondary)]">{Object.entries(preview.data.excluded).filter(([, total]) => total > 0).map(([reason, total]) => <li key={reason}>{total} fora: {POST_SALE_EXCLUSION_LABELS[reason as PostSaleExclusionReason] ?? reason.replaceAll("_", " ")}</li>)}</ul>
            <div className={styles.chips}>{preview.data.examples.map((example) => <span className={page.badge} key={example.leadId}>{example.name} · {example.channelType === "meta" ? "Meta" : "WhatsApp"}</span>)}</div>
            {!preview.data.canStart ? <p className={page.muted} role="alert">{preview.data.totalEligible === 0 ? ((preview.data.excluded.template_unapproved ?? 0) > 0 ? "Nenhum lead pode receber agora. Os leads do número oficial esperam a Meta aprovar o template pos_venda_apresentacao." : "Nenhum lead pode receber agora. Ajuste o público.") : "Reduza o público para iniciar a campanha."}</p> : null}
          </section>
        ) : null}
        {preview && !preview.ok ? <p className={page.muted} role="alert">{preview.error}</p> : null}
      </section>

      <section className={page.card} aria-labelledby="pos-venda-campanhas">
        <div className={page.cardHead}>
          <h2 id="pos-venda-campanhas" className={page.cardTitle}>Campanhas recentes</h2>
          <p className={page.cardDescription}>Últimas campanhas desta empresa ou unidade, manuais e da régua.</p>
        </div>
        {data.campaigns.length ? (
          <ul className={styles.alertList}>
            {data.campaigns.map((campaign) => (
              <li key={campaign.id} className={styles.alertItem}>
                <div className={styles.alertText}>
                  <span className={page.cellTitle}>{campaign.name}</span>
                  <span className={page.cellSub}>{new Date(campaign.createdAt).toLocaleDateString("pt-BR")} · {postSaleRuleLabel(campaign.ruleKey)}</span>
                  <span className={`${page.cellSub} ${page.numeric}`}>{campaign.counts.sent} enviadas · {campaign.counts.failed} falharam · {campaign.counts.skipped} puladas{campaign.counts.queued ? ` · ${campaign.counts.queued} na fila` : ""}</span>
                  {retryFeedback?.campaignId === campaign.id ? <span className={styles.detail} role={retryFeedback.error ? "alert" : "status"}>{retryFeedback.text}</span> : null}
                </div>
                {campaign.ruleKey === null && campaign.status !== "draft" && campaign.counts.retryable > 0 ? (
                  <button type="button" className={page.button} disabled={busy} onClick={() => retryFailed(campaign)}>Reenviar as que falharam ({campaign.counts.retryable})</button>
                ) : null}
                {campaign.ruleKey === null ? (
                  <LiteMenu label={`Ações de ${campaign.name}`} items={[{ id: "duplicar", label: "Duplicar", onSelect: () => duplicate(campaign), disabled: busy }]} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p className={page.muted}>Nenhuma campanha foi criada ainda.</p>}
      </section>
    </div>
  );
}
