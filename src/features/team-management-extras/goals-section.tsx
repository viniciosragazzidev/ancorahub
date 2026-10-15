"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ActionButton } from "@/components/arc/action-button/action-button";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Input } from "@/components/arc/input/input";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Button } from "@/components/ui/button";
import { saveLiteGoalAction } from "@/features/goals/lite-goals-actions";
import type { LiteGoalView, TeamGoalsView } from "@/features/goals/lite-goals-queries";
import { LITE_GOAL_TYPES, type LiteGoalType } from "@/features/goals/lite-goals-policy";

import styles from "./team-extras.module.css";

const TYPE_LABEL: Record<LiteGoalType, string> = {
  quotes_count: "Cotações criadas",
  sales_count: "Vendas",
  leads_contacted: "Leads contatados",
  sla_rate: "SLA no prazo (%)",
  response_minutes: "Tempo para aceitar (min)",
};

const TYPE_UNIT: Record<LiteGoalType, string> = {
  quotes_count: "cotações",
  sales_count: "vendas",
  leads_contacted: "leads",
  sla_rate: "% no prazo",
  response_minutes: "min",
};

const periodFormat = (period: string) => {
  const [year, month] = period.split("-").map(Number);
  const text = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, 1)));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** "6 de 8 cotações · 75%". Tempo de resposta: menor é melhor, então a frase fala em "até". */
export function goalLine(goal: LiteGoalView): string {
  const type = goal.targetType as LiteGoalType;
  const unit = TYPE_UNIT[type] ?? "";
  if (type === "response_minutes") return `Agora ${goal.current} min · meta até ${goal.targetValue} min · ${goal.percentage}%`;
  return `${goal.current} de ${goal.targetValue} ${unit} · ${goal.percentage}%`;
}

type SheetTarget = { scope: "team" | "broker"; scopeId: string; label: string; goal: LiteGoalView | null };

function GoalBar({ percentage }: { percentage: number }) {
  return <span className={styles.track}><i style={{ width: `${Math.min(100, percentage)}%` }} /></span>;
}

export function GoalsSection({ supervisorId, view, canEditTeam, canEditBrokers }: { supervisorId: string; view: TeamGoalsView; canEditTeam: boolean; canEditBrokers: boolean }) {
  const router = useRouter();
  const [target, setTarget] = useState<SheetTarget | null>(null);
  const [type, setType] = useState<LiteGoalType>("quotes_count");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, startSaving] = useTransition();

  function openSheet(next: SheetTarget) {
    setTarget(next);
    setType(next.goal ? (next.goal.targetType as LiteGoalType) : "quotes_count");
    setName(next.goal?.name ?? "");
    setValue(next.goal ? String(next.goal.targetValue) : "");
    setFeedback("");
  }

  function save() {
    if (!target) return;
    startSaving(async () => {
      const result = await saveLiteGoalAction({
        id: target.goal?.id ?? null,
        scope: target.scope,
        scopeId: target.scopeId,
        name: name.trim() || TYPE_LABEL[type],
        targetType: type,
        targetValue: Number(value.replace(",", ".")),
        period: view.period,
      });
      if (!result.ok) {
        setFeedback(result.message);
        throw new Error(result.message);
      }
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <section className={`${styles.card} ${styles.goals}`} aria-labelledby="goals-title">
      <div className={styles.sectionHeading}>
        <h2 id="goals-title">Metas</h2>
        <span>{periodFormat(view.period)}</span>
      </div>

      <div className={styles.goalBlock}>
        <p className={styles.goalKind}>Da equipe</p>
        {view.team ? (
          <div className={styles.goalRow}>
            <div>
              <strong>{view.team.name}</strong>
              <span>{goalLine(view.team)}</span>
              <GoalBar percentage={view.team.percentage} />
            </div>
            {canEditTeam ? <Button size="sm" variant="outline" onClick={() => openSheet({ scope: "team", scopeId: view.team!.scopeId, label: "Meta da equipe", goal: view.team })}>Editar</Button> : null}
          </div>
        ) : (
          <div className={styles.goalRow}>
            <span className={styles.muted}>Sem meta da equipe neste mês.</span>
            {canEditTeam ? <Button size="sm" variant="outline" onClick={() => openSheet({ scope: "team", scopeId: supervisorId, label: "Meta da equipe", goal: null })}>Definir meta da equipe</Button> : null}
          </div>
        )}
      </div>

      {view.brokers.length ? (
        <div className={styles.goalBlock}>
          <p className={styles.goalKind}>Dos corretores</p>
          <ul className={styles.goalList}>
            {view.brokers.map((broker) => (
              <li key={broker.brokerId} className={styles.goalRow}>
                <div>
                  <strong>{broker.name}</strong>
                  <span>{broker.goal ? goalLine(broker.goal) : "Sem meta neste mês"}</span>
                  {broker.goal ? <GoalBar percentage={broker.goal.percentage} /> : null}
                </div>
                {canEditBrokers ? (
                  <Button size="sm" variant="outline" onClick={() => openSheet({ scope: "broker", scopeId: broker.brokerId, label: broker.name, goal: broker.goal })}>
                    {broker.goal ? "Editar" : "Definir meta"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <BottomSheet
        className="arc-venancor"
        open={target !== null}
        onOpenChange={(open) => { if (!open) setTarget(null); }}
        title={target?.goal ? "Editar meta" : "Nova meta"}
        description={target ? `${target.label} · ${periodFormat(view.period)}` : undefined}
        closeLabel="Fechar"
        detents={[0.7, 0.92]}
      >
        <div className={styles.sheetForm}>
          <Input label="Nome da meta" id="goal-name" value={name} maxLength={120} placeholder={TYPE_LABEL[type]} onChange={(event) => setName(event.currentTarget.value)} />
          <SegmentedControl
            label="Tipo de meta"
            value={type}
            onValueChange={(next) => setType(next as LiteGoalType)}
            options={LITE_GOAL_TYPES.map((item) => ({ value: item, label: TYPE_LABEL[item] }))}
          />
          <Input label={type === "response_minutes" ? "Tempo máximo (min)" : "Valor da meta"} id="goal-value" inputMode="decimal" value={value} onChange={(event) => setValue(event.currentTarget.value)} />
          <ActionButton label="Salvar meta" pendingLabel="Salvando" successLabel="Meta salva" disabled={!value.trim() || saving} onAction={save} onActionError={() => undefined} />
          <p className={styles.feedback} role="status" aria-live="polite">{feedback}</p>
        </div>
      </BottomSheet>
    </section>
  );
}
