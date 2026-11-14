"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ActionButton } from "@/components/arc/action-button/action-button";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Input } from "@/components/arc/input/input";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { saveLiteGoalAction } from "@/features/goals/lite-goals-actions";
import type { LiteGoalView } from "@/features/goals/lite-goals-queries";
import { LITE_GOAL_TYPES, type LiteGoalType } from "@/features/goals/lite-goals-policy";

import { motionTokens } from "@/components/arc/motion-tokens";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { periodFormat, TYPE_LABEL } from "./goal-format";
import styles from "./team-extras.module.css";

/** Quem recebe a meta: a equipe (scope team, id do supervisor) ou um corretor (scope broker). */
export type GoalSheetTarget = { scope: "team" | "broker"; scopeId: string; label: string; goal: LiteGoalView | null };

/**
 * Bottom-sheet de criar/editar meta (Arc). Salva pelo mesmo servidor do Lite, com escopo checado.
 * Feedback nível 1 (FEEDBACK.md): o botão espera a resposta do servidor ("Salvando"), confirma com o check
 * e o sheet fecha logo depois; erro com causa, a meta anterior continua valendo e o botão vira tentativa nova.
 */
export function GoalSheet({ target, period, onClose }: { target: GoalSheetTarget | null; period: string; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState<LiteGoalType>("quotes_count");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const fire = useFeedback();
  const closeTimer = useRef<number | null>(null);
  useEffect(() => () => { if (closeTimer.current) window.clearTimeout(closeTimer.current); }, []);
  const [seenTarget, setSeenTarget] = useState<GoalSheetTarget | null>(null);

  // Abrir outra meta (ou a mesma de novo) preenche o formulário com o que ela tem hoje.
  if (target !== seenTarget) {
    setSeenTarget(target);
    setType(target?.goal ? (target.goal.targetType as LiteGoalType) : "quotes_count");
    setName(target?.goal?.name ?? "");
    setValue(target?.goal ? String(target.goal.targetValue) : "");
    setFeedback("");
  }

  // Antes o save rodava dentro de startTransition e o botão confirmava antes do servidor; agora ele espera.
  async function save() {
    if (!target) return;
    setFeedback("");
    setSaving(true);
    fire("tap");
    const keeps = target.goal ? "A meta anterior continua valendo" : "Nenhuma meta foi criada";
    try {
      const result = await saveLiteGoalAction({
        id: target.goal?.id ?? null,
        scope: target.scope,
        scopeId: target.scopeId,
        name: name.trim() || TYPE_LABEL[type],
        targetType: type,
        targetValue: Number(value.replace(",", ".")),
        period,
      });
      if (!result.ok) throw result;
    } catch (error) {
      fire("error");
      setFeedback(actionErrorMessage(normalizeActionError(error, "Não consegui salvar a meta agora"), keeps));
      throw error instanceof Error ? error : new Error("goal");
    } finally {
      setSaving(false);
    }
    fire("confirm");
    router.refresh();
    // O check do botão aparece antes de o sheet fechar.
    closeTimer.current = window.setTimeout(onClose, motionTokens.beat.after * 2000);
  }

  return (
    <BottomSheet
      className="arc-venancor"
      open={target !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={target?.goal ? "Editar meta" : "Nova meta"}
      description={target ? `${target.label} · ${periodFormat(period)}` : undefined}
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
        <ActionButton label={feedback ? "Tentar de novo" : "Salvar meta"} pendingLabel="Salvando" successLabel="Meta salva" disabled={!value.trim() || saving} onAction={save} onActionError={() => undefined} />
        {feedback ? <p className={styles.feedback} role="alert">{feedback}</p> : null}
      </div>
    </BottomSheet>
  );
}
