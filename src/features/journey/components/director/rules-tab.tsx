"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";

import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsInputField } from "@/components/ui/ds-input-field";
import { DsOutlinedActionButton } from "@/components/ui/ds-outlined-action-button";
import { DsSectionHeader } from "@/components/ui/ds-section-header";
import { DsSwitch } from "@/components/ui/ds-switch";
import type { EngagementRule } from "@/features/engagement/catalog";
import type { JourneyActionResponse, JourneyRulesData, UpdateJourneyRuleInput } from "@/features/journey/director-types";

/** Rules (director): turn each rule on or off and adjust points and the daily cap. Old points are never recalculated. */
export function RulesTab({ rules, onUpdate, onRestore }: { rules: JourneyRulesData | null; onUpdate?: (input: UpdateJourneyRuleInput) => Promise<JourneyActionResponse>; onRestore?: () => Promise<JourneyActionResponse> }) {
  const [restoring, startRestore] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  if (!rules?.available) return <DsEmptyState className="mt-ds-24" bordered title="Regras indisponíveis" description="As regras aparecem quando a jornada estiver ligada." />;
  return (
    <div className="mt-ds-24 space-y-ds-16 ds-fade">
      <DsSectionHeader
        title="Regras de pontos"
        description="Mudanças valem dos próximos fatos em diante; pontos já ganhos não mudam."
        actions={onRestore ? <DsOutlinedActionButton loading={restoring} onClick={() => startRestore(async () => { const result = await onRestore(); setNotice(result.ok ? "Valores padrão restaurados. Recarregue para ver." : result.message); })}><span className="inline-flex items-center gap-1.5"><RotateCcw size={14} aria-hidden="true" />Restaurar padrão</span></DsOutlinedActionButton> : null}
      />
      {notice ? <p role="status" className="text-sm text-muted-foreground">{notice}</p> : null}
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {rules.rules.map((rule) => <RuleRow key={rule.key} rule={rule} onUpdate={onUpdate} />)}
      </ul>
    </div>
  );
}

function RuleRow({ rule, onUpdate }: { rule: EngagementRule; onUpdate?: (input: UpdateJourneyRuleInput) => Promise<JourneyActionResponse> }) {
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
    <li className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex items-start gap-3">
        <DsSwitch className="relative mt-0.5 before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']" checked={enabled} aria-label={`${enabled ? "Desligar" : "Ligar"} ${rule.label}`} onCheckedChange={(checked) => { setEnabled(checked); save({ enabled: checked }); }} disabled={pending || !onUpdate} />
        <div className="min-w-0">
          <p className="font-medium">{rule.label}</p>
          <p className="text-xs text-muted-foreground">{rule.hint}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1"><span className="block text-xs text-muted-foreground">Pontos</span><DsInputField className="w-24" type="number" min={0} max={500} value={points} disabled={!enabled} onChange={(event) => { setPoints(Number(event.target.value) || 0); setState("idle"); }} /></label>
        <label className="space-y-1"><span className="block text-xs text-muted-foreground">Limite por dia</span><DsInputField className="w-28" type="number" min={1} max={100} value={cap ?? ""} placeholder="Livre" disabled={!enabled} onChange={(event) => { setCap(event.target.value ? Number(event.target.value) : null); setState("idle"); }} /></label>
        <DsOutlinedActionButton loading={pending} disabled={!dirty || !onUpdate} onClick={() => save()}>Salvar</DsOutlinedActionButton>
        <span role="status" className={`min-w-12 text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>{state === "idle" ? "" : message}</span>
      </div>
    </li>
  );
}
