"use client";

import { useState } from "react";
import { Flag, Gauge, ShieldAlert, Trophy } from "lucide-react";

import { DsCountUp } from "@/components/ui/ds-count-up";
import { DsDashboardCard } from "@/components/ui/ds-dashboard-card";
import { DsDonutChart } from "@/components/ui/ds-donut-chart";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsSectionHeader } from "@/components/ui/ds-section-header";
import { DsStatTile } from "@/components/ui/ds-stat-tile";
import { DsTabs, DsTabsList, DsTabsPanel, DsTabsTrigger } from "@/components/ui/ds-tabs";
import type {
  CreateJourneyCampaignInput, JourneyActionResponse, JourneyCampaignAudienceOptions, JourneyCampaignRow,
  JourneyDirectorDashboard, JourneyRiskReport, JourneyRulesData, ReverseJourneyEventInput, UpdateJourneyRuleInput,
} from "@/features/journey/director-types";

import { AuditTab } from "./audit-tab";
import { CampaignsTab } from "./campaigns-tab";
import { RulesTab } from "./rules-tab";

export type DirectorJourneyActions = {
  createCampaign?: (input: CreateJourneyCampaignInput) => Promise<JourneyActionResponse<JourneyCampaignRow>>;
  pauseCampaign?: (campaignId: string) => Promise<JourneyActionResponse>;
  updateRule?: (input: UpdateJourneyRuleInput) => Promise<JourneyActionResponse>;
  restoreRules?: () => Promise<JourneyActionResponse>;
  reverseEvent?: (input: ReverseJourneyEventInput) => Promise<JourneyActionResponse>;
};

export type DirectorJourneyData = {
  dashboard: JourneyDirectorDashboard | null;
  campaigns: JourneyCampaignRow[] | null;
  audience: JourneyCampaignAudienceOptions | null;
  rules: JourneyRulesData | null;
  risk: JourneyRiskReport | null;
  /** Only the director edits rules and reverses points; managers see the rest in their scope. */
  canManageRules: boolean;
};

const pts = (value: number) => `${Math.round(value).toLocaleString("pt-BR")} pts`;

/**
 * "Jornada da equipe" for the director and the manager (normal mode): where the
 * points come from, who is engaged, campaigns, rules and the audit of points.
 */
export function DirectorJourneyPanel({ data, actions, initialTab = "overview" }: { data: DirectorJourneyData; actions: DirectorJourneyActions; initialTab?: "overview" | "campaigns" | "rules" | "audit" }) {
  const [tab, setTab] = useState<string>(initialTab);
  const outliers = data.risk?.brokers.filter((broker) => broker.rules.some((rule) => rule.outlier)).length ?? 0;
  return (
    <DsTabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <DsTabsList>
        <DsTabsTrigger value="overview" icon={<Gauge size={14} />}>Visão geral</DsTabsTrigger>
        <DsTabsTrigger value="campaigns" icon={<Flag size={14} />} count={data.campaigns?.filter((campaign) => campaign.status === "active").length || undefined}>Campanhas</DsTabsTrigger>
        {data.canManageRules ? <DsTabsTrigger value="rules" icon={<Trophy size={14} />}>Regras</DsTabsTrigger> : null}
        {data.canManageRules ? <DsTabsTrigger value="audit" icon={<ShieldAlert size={14} />} count={outliers || undefined}>Auditoria</DsTabsTrigger> : null}
      </DsTabsList>

      <DsTabsPanel value="overview"><Overview dashboard={data.dashboard} /></DsTabsPanel>
      <DsTabsPanel value="campaigns"><CampaignsTab campaigns={data.campaigns} audience={data.audience} onCreate={actions.createCampaign} onPause={actions.pauseCampaign} /></DsTabsPanel>
      {data.canManageRules ? <DsTabsPanel value="rules"><RulesTab rules={data.rules} onUpdate={actions.updateRule} onRestore={actions.restoreRules} /></DsTabsPanel> : null}
      {data.canManageRules ? <DsTabsPanel value="audit"><AuditTab report={data.risk} onReverse={actions.reverseEvent} /></DsTabsPanel> : null}
    </DsTabs>
  );
}

function Overview({ dashboard }: { dashboard: JourneyDirectorDashboard | null }) {
  if (!dashboard || !dashboard.available) {
    return <DsEmptyState className="mt-ds-24" bordered title="A jornada ainda não está ligada" description="Quando a jornada do corretor for ativada, os pontos da semana aparecem aqui." />;
  }
  const totalPoints = dashboard.pointsByRule.reduce((sum, rule) => sum + rule.points, 0);
  const completions = dashboard.topMissions.reduce((sum, mission) => sum + mission.completed, 0);
  const maxUnit = Math.max(1, ...dashboard.units.map((unit) => unit.points));
  return (
    <div className="mt-ds-24 space-y-ds-24 ds-fade">
      <DsDashboardCard className="grid gap-ds-24 p-ds-16 sm:grid-cols-3">
        <DsStatTile label="Pontos na semana" value={<DsCountUp value={Math.round(totalPoints)} />} hint="Só fatos com evidência" />
        <DsStatTile label="Corretores pontuando" value={<span><DsCountUp value={dashboard.adoption.scoringBrokers} /> de {dashboard.adoption.activeBrokers}</span>} hint={`${dashboard.adoption.percentage}% da equipe ativa`} tone={dashboard.adoption.percentage >= 60 ? "success" : dashboard.adoption.percentage >= 30 ? "default" : "warning"} />
        <DsStatTile label="Missões concluídas" value={<DsCountUp value={completions} />} hint="Nesta semana" />
      </DsDashboardCard>

      <div className="grid items-start gap-ds-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <DsDashboardCard className="min-w-0 space-y-ds-16 p-ds-16">
          <DsSectionHeader as="h2" title="De onde vêm os pontos" description="Por regra, na semana." />
          {dashboard.pointsByRule.length ? (
            <div className="space-y-ds-16">
              <DsDonutChart className="w-full" data={dashboard.pointsByRule.map((rule) => ({ key: rule.ruleKey, label: rule.label, value: rule.points }))} centerValue={Math.round(totalPoints).toLocaleString("pt-BR")} centerLabel="pts na semana" size={168} />
              <ul className="divide-y divide-border text-sm">
                {dashboard.pointsByRule.map((rule) => (
                  <li key={rule.ruleKey} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate">{rule.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{pts(rule.points)} · {rule.events}x</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-sm text-muted-foreground">Nenhum ponto nesta semana ainda.</p>}
        </DsDashboardCard>

        <DsDashboardCard className="min-w-0 space-y-ds-16 p-ds-16">
          <DsSectionHeader as="h2" title="Unidades" description="Pontos da semana e quantos corretores estão pontuando." />
          {dashboard.units.length ? (
            <ol className="space-y-3">
              {[...dashboard.units].sort((a, b) => b.points - a.points).map((unit, index) => (
                <li key={unit.branchId} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium"><span className="mr-2 tabular-nums text-muted-foreground">{index + 1}º</span>{unit.branchName}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{pts(unit.points)} · {unit.adoption.percentage}% pontuando</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${Math.max(2, (unit.points / maxUnit) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">Sem unidades com corretores ativos.</p>}
        </DsDashboardCard>
      </div>

      <div className="grid items-start gap-ds-24 lg:grid-cols-2">
        <DsDashboardCard className="min-w-0 space-y-ds-16 p-ds-16">
          <DsSectionHeader as="h2" title="Equipes" description="Média de pontos por corretor ativo." />
          {dashboard.teams.length ? (
            <ol className="divide-y divide-border">
              {dashboard.teams.map((team) => (
                <li key={team.supervisorId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate"><span className="mr-2 tabular-nums text-muted-foreground">{team.position}º</span><span className="font-medium">{team.name}</span> <span className="text-muted-foreground">· {team.activeBrokers} {team.activeBrokers === 1 ? "corretor" : "corretores"}</span></span>
                  <span className="shrink-0 tabular-nums">{pts(team.averagePoints)}<span className="text-muted-foreground">/corretor</span></span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">Nenhuma equipe de supervisor com pontos ainda.</p>}
        </DsDashboardCard>

        <DsDashboardCard className="min-w-0 space-y-ds-16 p-ds-16">
          <DsSectionHeader as="h2" title="Missões mais concluídas" description="O que a equipe mais completou na semana." />
          {dashboard.topMissions.length ? (
            <ol className="divide-y divide-border">
              {dashboard.topMissions.map((mission) => (
                <li key={mission.missionId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate">{mission.title}{mission.kind === "campaign" ? <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Campanha</span> : null}</span>
                  <span className="shrink-0 tabular-nums">{mission.completed}x</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted-foreground">Nenhuma missão concluída ainda.</p>}
        </DsDashboardCard>
      </div>
    </div>
  );
}
