"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { LiteGoalView, TeamGoalsView } from "@/features/goals/lite-goals-queries";

import { goalLine, periodFormat } from "./goal-format";
import { GoalSheet, type GoalSheetTarget } from "./goal-sheet";
import styles from "./team-extras.module.css";

export { goalLine } from "./goal-format";

function GoalBar({ percentage }: { percentage: number }) {
  return <span className={styles.track}><i style={{ width: `${Math.min(100, percentage)}%` }} /></span>;
}

export function GoalsSection({ supervisorId, view, canEditTeam, canEditBrokers }: { supervisorId: string; view: TeamGoalsView; canEditTeam: boolean; canEditBrokers: boolean }) {
  const [target, setTarget] = useState<GoalSheetTarget | null>(null);

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
            {canEditTeam ? <Button size="sm" variant="outline" onClick={() => setTarget({ scope: "team", scopeId: view.team!.scopeId, label: "Meta da equipe", goal: view.team })}>Editar</Button> : null}
          </div>
        ) : (
          <div className={styles.goalRow}>
            <span className={styles.muted}>Sem meta da equipe neste mês.</span>
            {canEditTeam ? <Button size="sm" variant="outline" onClick={() => setTarget({ scope: "team", scopeId: supervisorId, label: "Meta da equipe", goal: null })}>Definir meta da equipe</Button> : null}
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
                  <Button size="sm" variant="outline" onClick={() => setTarget({ scope: "broker", scopeId: broker.brokerId, label: broker.name, goal: broker.goal })}>
                    {broker.goal ? "Editar" : "Definir meta"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <GoalSheet target={target} period={view.period} onClose={() => setTarget(null)} />
    </section>
  );
}

/** Meta do mês de um corretor, no perfil dele. O supervisor edita pelo mesmo bottom-sheet. */
export function BrokerMonthGoal({ brokerId, brokerName, period, goal, canEdit }: { brokerId: string; brokerName: string; period: string; goal: LiteGoalView | null; canEdit: boolean }) {
  const [target, setTarget] = useState<GoalSheetTarget | null>(null);
  return (
    <section className={`${styles.card} ${styles.goals}`} aria-labelledby="broker-goal-title">
      <div className={styles.sectionHeading}>
        <h2 id="broker-goal-title">Meta do mês</h2>
        <span>{periodFormat(period)}</span>
      </div>
      <div className={styles.goalRow}>
        <div>
          {goal ? (
            <>
              <strong>{goal.name}</strong>
              <span>{goalLine(goal)}</span>
              <GoalBar percentage={goal.percentage} />
            </>
          ) : <span className={styles.muted}>Sem meta neste mês.</span>}
        </div>
        {canEdit ? <Button size="sm" variant="outline" onClick={() => setTarget({ scope: "broker", scopeId: brokerId, label: brokerName, goal })}>{goal ? "Editar" : "Definir meta"}</Button> : null}
      </div>
      <GoalSheet target={target} period={period} onClose={() => setTarget(null)} />
    </section>
  );
}
