"use client";

/**
 * "Jornada da equipe" no visual Lite do diretor. Mesmos dados (getDirectorJourneyPageData) e as mesmas Server Actions
 * da tela de hoje (createCampaign, pauseCampaign, updateRule, restoreRules, reverseEvent), com os mesmos argumentos e
 * as mesmas validações. Regras e Auditoria seguem a regra de hoje: só aparecem com `canManageRules`.
 * Troca as peças ds-* (DsSheet, DsDialog, DsSwitch, DsInputField, DsStatTile, DsDonutChart...) por peças Lite.
 */
import { useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { Flag, Plus, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EngagementRule } from "@/features/engagement/catalog";
import type { MissionMetric } from "@/features/engagement/journey-types";
import type { DirectorJourneyActions, DirectorJourneyData } from "@/features/journey/components/director/director-journey-panel";
import { METRIC_LABEL } from "@/features/journey/components/director/campaigns-tab";
import type {
  CreateJourneyCampaignInput, JourneyActionResponse, JourneyCampaignAudienceOptions, JourneyCampaignRow,
  JourneyDirectorDashboard, JourneyRiskEvent, JourneyRiskReport, JourneyRulesData, ReverseJourneyEventInput, UpdateJourneyRuleInput,
} from "@/features/journey/director-types";

import { LiteCheckList, LiteChoices } from "./relationship-messages-lite";
import styles from "./relationship-lite.module.css";

const CAMPAIGN_METRICS = ["contacts.evidenced", "contacts.on_time", "contacts.days_on_time", "returns.cleared", "notes.coverage", "sla.no_breach"] as const;
type AudienceKind = "all" | "branches" | "teams" | "duties" | "brokers";

const pts = (value: number) => `${Math.round(value).toLocaleString("pt-BR")} pts`;
const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" };
const DATE_TIME: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };
/** Soma dias a uma data de calendário "AAAA-MM-DD" (sem relógio do navegador: o "hoje" vem do servidor). */
const plusDays = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);

function SectionHead({ title, description, actions, as: Heading = "h2" }: { title: string; description?: string; actions?: ReactNode; as?: "h2" | "h3" }) {
  return (
    <div className={styles.sectionHead}>
      <div className={styles.sectionText}>
        <Heading className={styles.sectionTitle}>{title}</Heading>
        {description ? <p className={page.cardDescription}>{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className={page.empty}>
      {icon}
      <p className={page.emptyTitle}>{title}</p>
      <p className={page.emptyText}>{text}</p>
      {action}
    </div>
  );
}

/** `today`: dia de hoje em São Paulo ("AAAA-MM-DD"), calculado no servidor para não variar na hidratação. */
export function DirectorJourneyLite({ data, actions, today }: { data: DirectorJourneyData; actions: DirectorJourneyActions; today: string }) {
  const [tab, setTab] = useState("overview");
  const outliers = data.risk?.brokers.filter((broker) => broker.rules.some((rule) => rule.outlier)).length ?? 0;
  const activeCampaigns = data.campaigns?.filter((campaign) => campaign.status === "active").length || 0;
  return (
    <Tabs value={tab} onValueChange={setTab} variant="segment" className={styles.tabs}>
      <div className={styles.tabList}>
        <TabsList aria-label="Jornada da equipe" className="w-max">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas{activeCampaigns ? <span className={styles.tabCount}>{activeCampaigns}</span> : null}</TabsTrigger>
          {data.canManageRules ? <TabsTrigger value="rules">Regras</TabsTrigger> : null}
          {data.canManageRules ? <TabsTrigger value="audit">Auditoria{outliers ? <span className={styles.tabCount}>{outliers}</span> : null}</TabsTrigger> : null}
        </TabsList>
      </div>
      <TabsContent value="overview" className={styles.panel}><Overview dashboard={data.dashboard} /></TabsContent>
      <TabsContent value="campaigns" className={styles.panel}><Campaigns today={today} campaigns={data.campaigns} audience={data.audience} onCreate={actions.createCampaign} onPause={actions.pauseCampaign} /></TabsContent>
      {data.canManageRules ? <TabsContent value="rules" className={styles.panel}><Rules rules={data.rules} onUpdate={actions.updateRule} onRestore={actions.restoreRules} /></TabsContent> : null}
      {data.canManageRules ? <TabsContent value="audit" className={styles.panel}><Audit report={data.risk} onReverse={actions.reverseEvent} /></TabsContent> : null}
    </Tabs>
  );
}

/* Visão geral */

function Overview({ dashboard }: { dashboard: JourneyDirectorDashboard | null }) {
  if (!dashboard || !dashboard.available) {
    return <Empty title="A jornada ainda não está ligada" text="Quando a jornada do corretor for ativada, os pontos da semana aparecem aqui." />;
  }
  const totalPoints = dashboard.pointsByRule.reduce((sum, rule) => sum + rule.points, 0);
  const completions = dashboard.topMissions.reduce((sum, mission) => sum + mission.completed, 0);
  const maxUnit = Math.max(1, ...dashboard.units.map((unit) => unit.points));
  const adoptionTone = dashboard.adoption.percentage >= 60 ? "success" : dashboard.adoption.percentage >= 30 ? undefined : "warning";
  return (
    <>
      <div className={page.stats}>
        <div className={page.stat}>
          <span className={page.statLabel}>Pontos na semana</span>
          <span className={page.statValue}>{Math.round(totalPoints).toLocaleString("pt-BR")}</span>
          <span className={page.statHint}>Só fatos com evidência</span>
        </div>
        <div className={page.stat}>
          <span className={page.statLabel}>Corretores pontuando</span>
          <span className={page.statValue}>{dashboard.adoption.scoringBrokers.toLocaleString("pt-BR")} de {dashboard.adoption.activeBrokers.toLocaleString("pt-BR")}</span>
          <span className={`${page.statHint} ${styles.statHint}`} data-tone={adoptionTone}>{dashboard.adoption.percentage}% da equipe ativa</span>
        </div>
        <div className={page.stat}>
          <span className={page.statLabel}>Missões concluídas</span>
          <span className={page.statValue}>{completions.toLocaleString("pt-BR")}</span>
          <span className={page.statHint}>Nesta semana</span>
        </div>
      </div>

      <div className={styles.pair}>
        <section className={page.card} aria-labelledby="journey-rules-share">
          <header className={page.cardHead}>
            <h2 id="journey-rules-share" className={page.cardTitle}>De onde vêm os pontos</h2>
            <p className={page.cardDescription}>Por regra, na semana: {pts(totalPoints)}.</p>
          </header>
          {dashboard.pointsByRule.length ? (
            <ul className={styles.bars}>
              {dashboard.pointsByRule.map((rule) => (
                <li key={rule.ruleKey} className={styles.bar}>
                  <div className={styles.barHead}>
                    <span className={styles.barLabel}>{rule.label}</span>
                    <span className={styles.barValue}>{pts(rule.points)} · {rule.events}x</span>
                  </div>
                  <div className={styles.track} aria-hidden="true">
                    <span className={styles.fill} style={{ width: `${totalPoints ? Math.max(2, (rule.points / totalPoints) * 100) : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className={styles.hint}>Nenhum ponto nesta semana ainda.</p>}
        </section>

        <section className={page.card} aria-labelledby="journey-units">
          <header className={page.cardHead}>
            <h2 id="journey-units" className={page.cardTitle}>Unidades</h2>
            <p className={page.cardDescription}>Pontos da semana e quantos corretores estão pontuando.</p>
          </header>
          {dashboard.units.length ? (
            <ol className={styles.bars}>
              {[...dashboard.units].sort((a, b) => b.points - a.points).map((unit, index) => (
                <li key={unit.branchId} className={styles.bar}>
                  <div className={styles.barHead}>
                    <span className={styles.barLabel}><span className={styles.position}>{index + 1}º</span>{unit.branchName}</span>
                    <span className={styles.barValue}>{pts(unit.points)} · {unit.adoption.percentage}% pontuando</span>
                  </div>
                  <div className={styles.track} aria-hidden="true">
                    <span className={styles.fill} style={{ width: `${Math.max(2, (unit.points / maxUnit) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className={styles.hint}>Sem unidades com corretores ativos.</p>}
        </section>
      </div>

      <div className={styles.pair}>
        <section className={page.card} aria-labelledby="journey-teams">
          <header className={page.cardHead}>
            <h2 id="journey-teams" className={page.cardTitle}>Equipes</h2>
            <p className={page.cardDescription}>Média de pontos por corretor ativo.</p>
          </header>
          {dashboard.teams.length ? (
            <ol className={styles.lines}>
              {dashboard.teams.map((team) => (
                <li key={team.supervisorId}>
                  <span className={styles.lineLabel}><span className={styles.position}>{team.position}º</span>{team.name} <span className={page.muted}>· {team.activeBrokers} {team.activeBrokers === 1 ? "corretor" : "corretores"}</span></span>
                  <span className={styles.lineValue}>{pts(team.averagePoints)}<span className={page.muted}>/corretor</span></span>
                </li>
              ))}
            </ol>
          ) : <p className={styles.hint}>Nenhuma equipe de supervisor com pontos ainda.</p>}
        </section>

        <section className={page.card} aria-labelledby="journey-missions">
          <header className={page.cardHead}>
            <h2 id="journey-missions" className={page.cardTitle}>Missões mais concluídas</h2>
            <p className={page.cardDescription}>O que a equipe mais completou na semana.</p>
          </header>
          {dashboard.topMissions.length ? (
            <ol className={styles.lines}>
              {dashboard.topMissions.map((mission) => (
                <li key={mission.missionId}>
                  <span className={styles.lineLabel}>{mission.title}{mission.kind === "campaign" ? <> <span className={page.badge}>Campanha</span></> : null}</span>
                  <span className={styles.lineValue}>{mission.completed}x</span>
                </li>
              ))}
            </ol>
          ) : <p className={styles.hint}>Nenhuma missão concluída ainda.</p>}
        </section>
      </div>
    </>
  );
}

/* Campanhas */

function Campaigns({ today, campaigns, audience, onCreate, onPause }: {
  today: string;
  campaigns: JourneyCampaignRow[] | null;
  audience: JourneyCampaignAudienceOptions | null;
  onCreate?: (input: CreateJourneyCampaignInput) => Promise<JourneyActionResponse<JourneyCampaignRow>>;
  onPause?: (campaignId: string) => Promise<JourneyActionResponse>;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(campaigns ?? []);
  const [pausing, startPause] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const available = Boolean(audience?.available && onCreate);

  function pause(id: string) {
    if (!onPause) return;
    startPause(async () => {
      const result = await onPause(id);
      if (!result.ok) { setNotice(result.message); return; }
      setRows((current) => current.map((row) => (row.id === id ? { ...row, status: "inactive" } : row)));
      setNotice("Campanha pausada.");
    });
  }

  const createButton = (label: string) => (
    <button type="button" className={page.primaryButton} onClick={() => setOpen(true)}><Plus aria-hidden="true" size={16} />{label}</button>
  );

  return (
    <>
      <SectionHead
        title="Campanhas"
        description="Uma meta com bônus para um público, por um período. Aparece na jornada de quem participa, com o progresso ao vivo."
        actions={available ? createButton("Nova campanha") : null}
      />
      {notice ? <p role="status" className={styles.status}>{notice}</p> : null}
      {!audience?.available ? (
        <Empty icon={<Flag aria-hidden="true" size={20} />} title="Campanhas desligadas" text="Ligue as campanhas no Super admin para criar a primeira." />
      ) : rows.length ? (
        <ul className={styles.cards}>
          {rows.map((campaign) => {
            const active = campaign.status === "active";
            return (
              <li key={campaign.id}>
                <div className={styles.rowHead}>
                  <div className={styles.rowText}>
                    <p className={styles.rowTitle}>{campaign.title}</p>
                    <p className={styles.rowMeta}>{METRIC_LABEL[campaign.metric] ?? campaign.metric} · meta {campaign.target}</p>
                  </div>
                  <span className={page.badge} data-tone={active ? "success" : undefined}>{active ? "Ativa" : "Pausada"}</span>
                </div>
                {campaign.description ? <p className={styles.hint}>{campaign.description}</p> : null}
                <div className={styles.cardFoot}>
                  <span className={page.numeric}>+{campaign.bonusPoints} pts · {campaign.startsAt ? formatLiteDate(campaign.startsAt, DAY_MONTH) : "agora"} até {campaign.endsAt ? formatLiteDate(campaign.endsAt, DAY_MONTH) : "sem fim"}</span>
                  {active && onPause ? <button type="button" className={`${page.button} ${styles.primary}`} disabled={pausing} onClick={() => pause(campaign.id)}>Pausar</button> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon={<Flag aria-hidden="true" size={20} />} title="Nenhuma campanha ainda" text="Ex.: Semana PME, 3 cotações PME, +100 pts para a unidade Centro." action={available ? createButton("Criar a primeira") : undefined} />
      )}
      {audience && onCreate ? (
        <CampaignPanel
          today={today}
          open={open}
          onOpenChange={setOpen}
          audience={audience}
          onCreate={async (input) => {
            const result = await onCreate(input);
            if (result.ok) { setRows((current) => [result.data, ...current]); setNotice("Campanha criada. Ela já aparece na jornada de quem participa."); }
            return result;
          }}
        />
      ) : null}
    </>
  );
}

function CampaignPanel({ today, open, onOpenChange, audience, onCreate }: { today: string; open: boolean; onOpenChange: (open: boolean) => void; audience: JourneyCampaignAudienceOptions; onCreate: (input: CreateJourneyCampaignInput) => Promise<JourneyActionResponse<JourneyCampaignRow>> }) {
  const ids = { title: useId(), description: useId(), target: useId(), bonus: useId(), starts: useId(), ends: useId() };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState<MissionMetric>("contacts.evidenced");
  const [target, setTarget] = useState(10);
  const [bonus, setBonus] = useState(50);
  const [startsAt, setStartsAt] = useState(today);
  const [endsAt, setEndsAt] = useState(plusDays(today, 6));
  const [kind, setKind] = useState<AudienceKind>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Mesmas opções de público da tela de hoje.
  const options = useMemo(() => {
    const list: { id: AudienceKind; label: string; count?: number }[] = [{ id: "all", label: "Todo o meu escopo" }];
    if (audience.branches.length > 1) list.push({ id: "branches", label: "Unidades", count: audience.branches.length });
    if (audience.teams.length) list.push({ id: "teams", label: "Equipes", count: audience.teams.length });
    if (audience.duties.length) list.push({ id: "duties", label: "Plantões", count: audience.duties.length });
    list.push({ id: "brokers", label: "Pessoas", count: audience.brokers.length });
    return list;
  }, [audience]);
  const items = kind === "branches" ? audience.branches : kind === "teams" ? audience.teams : kind === "duties" ? audience.duties : kind === "brokers" ? audience.brokers : [];
  const invalid = title.trim().length < 3 ? "Dê um nome para a campanha." : target < 1 ? "A meta precisa ser maior que zero." : bonus < 1 || bonus > 500 ? "O bônus vai de 1 a 500 pontos." : endsAt < startsAt ? "O fim precisa ser depois do começo." : kind !== "all" && !picked.size ? "Escolha quem participa." : null;

  function submit() {
    if (invalid) { setError(invalid); return; }
    setError(null);
    const selected = [...picked];
    const input: CreateJourneyCampaignInput = {
      title: title.trim(), description: description.trim() || undefined, metric, target, bonusPoints: bonus,
      startsAt: `${startsAt}T00:00:00-03:00`, endsAt: `${endsAt}T23:59:59-03:00`,
      audience: kind === "branches" ? { branchIds: selected } : kind === "teams" ? { supervisorIds: selected } : kind === "duties" ? { dutyScheduleIds: selected } : kind === "brokers" ? { userIds: selected } : {},
    };
    start(async () => {
      const result = await onCreate(input);
      if (!result.ok) { setError(result.message); return; }
      onOpenChange(false);
      setTitle(""); setDescription(""); setPicked(new Set());
    });
  }

  return (
    <LiteSidePanel open={open} onOpenChange={onOpenChange} title="Nova campanha" description="Os pontos só contam com evidência, como no resto da jornada.">
      <div className={form.form}>
        <div className={form.field}><label htmlFor={ids.title} className={form.label}>Nome</label><input id={ids.title} className={form.input} value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Semana PME" /></div>
        <div className={form.field}><label htmlFor={ids.description} className={form.label}>Descrição (opcional)</label><input id={ids.description} className={form.input} value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} placeholder="O que vale e por quê" /></div>
        <LiteSelect label="O que conta" value={metric} options={CAMPAIGN_METRICS.map((item) => ({ value: item, label: METRIC_LABEL[item] ?? item }))} onChange={(value) => setMetric(value as MissionMetric)} searchPlaceholder="Buscar meta" />
        <div className={form.row}>
          <div className={form.field}><label htmlFor={ids.target} className={form.label}>Meta</label><input id={ids.target} className={form.input} type="number" min={1} max={1000} value={target} onChange={(event) => setTarget(Number(event.target.value) || 0)} /></div>
          <div className={form.field}><label htmlFor={ids.bonus} className={form.label}>Bônus (pts)</label><input id={ids.bonus} className={form.input} type="number" min={1} max={500} value={bonus} onChange={(event) => setBonus(Number(event.target.value) || 0)} /></div>
        </div>
        <div className={form.row}>
          <div className={form.field}><label htmlFor={ids.starts} className={form.label}>Começa</label><input id={ids.starts} className={form.input} type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></div>
          <div className={form.field}><label htmlFor={ids.ends} className={form.label}>Termina</label><input id={ids.ends} className={form.input} type="date" value={endsAt} min={startsAt} onChange={(event) => setEndsAt(event.target.value)} /></div>
        </div>
        <div className={form.field}>
          <span className={form.label} aria-hidden="true">Quem participa</span>
          <LiteChoices label="Quem participa" value={kind} options={options} onChange={(value) => { setKind(value); setPicked(new Set()); }} />
          {kind === "all" ? <p className={form.hint}>Todos os corretores que você enxerga hoje.</p> : (
            <LiteCheckList label="Participantes" items={items.map((item) => ({ id: item.id, label: item.name }))} selected={picked} onToggle={(id) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} empty="Nada para escolher aqui." />
          )}
        </div>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <div className={form.actions}>
          <button type="button" className={page.button} onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="button" className={`${page.primaryButton} ${styles.primary}`} disabled={pending} onClick={submit}>{pending ? "Criando..." : "Criar campanha"}</button>
        </div>
      </div>
    </LiteSidePanel>
  );
}

/* Regras */

function Rules({ rules, onUpdate, onRestore }: { rules: JourneyRulesData | null; onUpdate?: (input: UpdateJourneyRuleInput) => Promise<JourneyActionResponse>; onRestore?: () => Promise<JourneyActionResponse> }) {
  const [restoring, startRestore] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  if (!rules?.available) return <Empty title="Regras indisponíveis" text="As regras aparecem quando a jornada estiver ligada." />;
  return (
    <section className={page.card} aria-labelledby="journey-rules">
      <div className={styles.sectionHead}>
        <div className={styles.sectionText}>
          <h2 id="journey-rules" className={page.cardTitle}>Regras de pontos</h2>
          <p className={page.cardDescription}>Mudanças valem dos próximos fatos em diante; pontos já ganhos não mudam.</p>
        </div>
        {onRestore ? (
          <button type="button" className={`${page.button} ${styles.primary}`} disabled={restoring} onClick={() => startRestore(async () => { const result = await onRestore(); setNotice(result.ok ? "Valores padrão restaurados. Recarregue para ver." : result.message); })}>
            <RotateCcw aria-hidden="true" size={16} />Restaurar padrão
          </button>
        ) : null}
      </div>
      {notice ? <p role="status" className={styles.status}>{notice}</p> : null}
      <ul className={styles.rows}>
        {rules.rules.map((rule) => <RuleRow key={rule.key} rule={rule} onUpdate={onUpdate} />)}
      </ul>
    </section>
  );
}

function RuleRow({ rule, onUpdate }: { rule: EngagementRule; onUpdate?: (input: UpdateJourneyRuleInput) => Promise<JourneyActionResponse> }) {
  const pointsId = useId();
  const capId = useId();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [points, setPoints] = useState(rule.points);
  const [cap, setCap] = useState<number | null>(rule.dailyCap);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const dirty = enabled !== rule.enabled || points !== rule.points || cap !== rule.dailyCap;

  function save(next: { enabled?: boolean } = {}) {
    if (!onUpdate) return;
    const input = { ruleKey: rule.key, enabled: next.enabled ?? enabled, points, dailyCap: cap };
    start(async () => {
      const result = await onUpdate(input);
      setState(result.ok ? "saved" : "error");
      setMessage(result.ok ? "Salvo" : result.message);
    });
  }

  return (
    <li className={styles.rule}>
      <div className={styles.ruleMain}>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${enabled ? "Desligar" : "Ligar"} ${rule.label}`}
          className={styles.switch}
          disabled={pending || !onUpdate}
          onClick={() => { const checked = !enabled; setEnabled(checked); save({ enabled: checked }); }}
        >
          <span className={styles.switchTrack} aria-hidden="true"><span className={styles.switchThumb} /></span>
        </button>
        <div className={styles.rowText}>
          <p className={styles.rowTitle}>{rule.label}</p>
          <p className={styles.rowMeta}>{rule.hint}</p>
        </div>
      </div>
      <div className={styles.ruleFields}>
        <div className={styles.ruleField}><label htmlFor={pointsId}><span>Pontos</span></label><input id={pointsId} className={`${form.input} ${styles.numberInput}`} type="number" min={0} max={500} value={points} disabled={!enabled} onChange={(event) => { setPoints(Number(event.target.value) || 0); setState("idle"); }} /></div>
        <div className={styles.ruleField}><label htmlFor={capId}><span>Limite por dia</span></label><input id={capId} className={`${form.input} ${styles.numberInput}`} type="number" min={1} max={100} value={cap ?? ""} placeholder="Livre" disabled={!enabled} onChange={(event) => { setCap(event.target.value ? Number(event.target.value) : null); setState("idle"); }} /></div>
        <button type="button" className={`${page.button} ${styles.primary}`} disabled={!dirty || !onUpdate || pending} onClick={() => save()}>{pending ? "Salvando..." : "Salvar"}</button>
        <span role="status" className={styles.saved} data-tone={state === "error" ? "error" : undefined}>{state === "idle" ? "" : message}</span>
      </div>
    </li>
  );
}

/* Auditoria */

function Audit({ report, onReverse }: { report: JourneyRiskReport | null; onReverse?: (input: ReverseJourneyEventInput) => Promise<JourneyActionResponse> }) {
  const [events, setEvents] = useState(report?.events ?? []);
  const [target, setTarget] = useState<JourneyRiskEvent | null>(null);
  if (!report?.available) return <Empty title="Auditoria indisponível" text="Ela aparece quando a jornada estiver ligada." />;
  const flagged = report.brokers.filter((broker) => broker.rules.some((rule) => rule.outlier) || broker.repeatedNotes > 0 || broker.unusualContacts > 0);

  return (
    <>
      <div className={page.group}>
        <SectionHead title="Pontos fora do padrão" description="Quem pontuou muito acima da equipe numa regra, notas repetidas ou contatos estranhos. Não é acusação: é onde olhar primeiro." />
        {flagged.length ? (
          <ul className={styles.cards}>
            {flagged.map((broker) => (
              <li key={broker.brokerId}>
                <div className={styles.rowHead}>
                  <p className={styles.rowTitle}>{broker.name}</p>
                  <span className={`${page.muted} ${page.numeric}`}>{broker.points.toLocaleString("pt-BR")} pts</span>
                </div>
                <ul className={styles.badges}>
                  {broker.rules.filter((rule) => rule.outlier).map((rule) => <li key={rule.ruleKey}><span className={page.badge} data-tone="warning" title={`${rule.zScore.toFixed(1)} desvios acima da média da equipe`}>{rule.label}: bem acima da média</span></li>)}
                  {broker.repeatedNotes ? <li><span className={page.badge} data-tone="warning">{broker.repeatedNotes} notas repetidas</span></li> : null}
                  {broker.unusualContacts ? <li><span className={page.badge} data-tone="warning">{broker.unusualContacts} contatos estranhos</span></li> : null}
                </ul>
              </li>
            ))}
          </ul>
        ) : <Empty icon={<ShieldCheck aria-hidden="true" size={20} />} title="Nada fora do padrão nesta semana" text="Os pontos estão parecidos entre os corretores." />}
      </div>

      <section className={page.card} aria-labelledby="journey-events">
        <header className={page.cardHead}>
          <h2 id="journey-events" className={page.cardTitle}>Últimos pontos</h2>
          <p className={page.cardDescription}>Estornar tira o ponto do placar e do nível. Fica registrado quem estornou e por quê.</p>
        </header>
        {events.length ? (
          <ul className={styles.rows}>
            {events.map((event) => (
              <li key={event.id}>
                <div className={styles.row}>
                  <div className={styles.rowHead}>
                    <div className={styles.rowText}>
                      <p className={styles.rowTitle}>{event.brokerName} <span className={page.muted}>· {event.detail ?? event.ruleKey}</span></p>
                      <p className={styles.rowMeta}>{formatLiteDate(event.occurredAt, DATE_TIME)}</p>
                    </div>
                    <div className={styles.rowAside}>
                      <span className={event.reversedAt ? styles.reversed : styles.points}>+{event.points}</span>
                      {event.reversedAt ? <span className={page.badge}>Estornado</span> : onReverse ? <button type="button" className={page.button} onClick={() => setTarget(event)}>Estornar</button> : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty icon={<ShieldAlert aria-hidden="true" size={20} />} title="Nenhum ponto ainda" text="Os eventos aparecem aqui conforme a equipe pontua." />}
      </section>

      {onReverse ? (
        <ReversePanel
          event={target}
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            if (!target) return { ok: false, message: "Escolha um ponto." } as const;
            const result = await onReverse({ eventId: target.id, reason });
            if (result.ok) setEvents((current) => current.map((item) => (item.id === target.id ? { ...item, reversedAt: new Date().toISOString() } : item)));
            return result;
          }}
        />
      ) : null}
    </>
  );
}

function ReversePanel({ event, onClose, onConfirm }: { event: JourneyRiskEvent | null; onClose: () => void; onConfirm: (reason: string) => Promise<JourneyActionResponse> }) {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = () => { onClose(); setReason(""); setError(null); };
  return (
    <LiteSidePanel
      open={Boolean(event)}
      onOpenChange={(open) => { if (!open) close(); }}
      title={`Estornar ${event?.points ?? 0} pts de ${event?.brokerName ?? ""}?`}
      description="O corretor vê o estorno no extrato dele. Diga o motivo com clareza."
    >
      <div className={form.form}>
        <div className={form.field}>
          <label htmlFor={reasonId} className={form.label}>Motivo</label>
          <input id={reasonId} className={form.input} value={reason} maxLength={200} onChange={(change) => setReason(change.target.value)} placeholder="Ex.: contato registrado sem mensagem enviada" />
        </div>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <div className={form.actions}>
          <button type="button" className={page.button} onClick={close}>Voltar</button>
          <button
            type="button"
            className={`${page.primaryButton} ${styles.primary}`}
            disabled={pending}
            onClick={() => {
              if (reason.trim().length < 5) { setError("Escreva o motivo (pelo menos 5 letras)."); return; }
              start(async () => { const result = await onConfirm(reason.trim()); if (result.ok) close(); else setError(result.message); });
            }}
          >
            {pending ? "Estornando..." : "Estornar"}
          </button>
        </div>
      </div>
    </LiteSidePanel>
  );
}
