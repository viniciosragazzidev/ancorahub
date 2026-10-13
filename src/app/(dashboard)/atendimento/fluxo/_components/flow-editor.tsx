"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ChevronDownIcon, ChevronUpIcon } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { QualificationFieldKey } from "@/features/qualification-engine/reply-composer";
import { saveQualificationFlowAction } from "@/features/qualification-flow/actions";
import { QUALIFICATION_FIELDS, questionTextProblem } from "@/features/qualification-flow/domain";

type Row = { key: QualificationFieldKey; enabled: boolean; text: string };

const fieldByKey = new Map(QUALIFICATION_FIELDS.map((field) => [field.key, field]));

/** Questions on first (in the saved order), then the ones off. */
function initialRows(enabledOrder: QualificationFieldKey[], texts: Partial<Record<QualificationFieldKey, string>>): Row[] {
  const off = QUALIFICATION_FIELDS.map((field) => field.key).filter((key) => !enabledOrder.includes(key));
  return [...enabledOrder.map((key) => ({ key, enabled: true })), ...off.map((key) => ({ key, enabled: false }))]
    .map((row) => ({ ...row, text: texts[row.key] ?? "" }));
}

/**
 * The AI's qualification questions as a list the director can reorder, turn on
 * or off and rewrite. An empty text keeps the system's own wording, which
 * adapts to the plan type (company, family, individual).
 */
export function FlowEditor({ enabledOrder, texts, canEdit }: { enabledOrder: QualificationFieldKey[]; texts: Partial<Record<QualificationFieldKey, string>>; canEdit: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => initialRows(enabledOrder, texts));
  const [saving, startSaving] = useTransition();
  const savedSignature = useMemo(() => JSON.stringify(initialRows(enabledOrder, texts)), [enabledOrder, texts]);
  const dirty = JSON.stringify(rows) !== savedSignature;
  const enabledCount = rows.filter((row) => row.enabled).length;
  const problems = rows.map((row) => (row.text.trim() ? questionTextProblem(row.key, row.text) : null));

  function move(index: number, delta: -1 | 1) {
    setRows((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function save() {
    const problem = problems.find(Boolean);
    if (problem) {
      toast.error(problem);
      return;
    }
    startSaving(async () => {
      const result = await saveQualificationFlowAction({
        order: rows.filter((row) => row.enabled).map((row) => row.key),
        texts: Object.fromEntries(rows.map((row) => [row.key, row.text])),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Fluxo salvo. Vale para as próximas conversas da IA.");
      router.refresh();
    });
  }

  // Position among the questions that are on (the ones off get none).
  const steps = rows.map((row, index) => (row.enabled ? rows.slice(0, index + 1).filter((item) => item.enabled).length : 0));
  return (
    <Card className="border-border/70 shadow-none">
      <SectionCardHeader
        title="Perguntas da qualificação"
        badge={<Badge variant="secondary">{enabledCount} ligadas</Badge>}
        description="A IA pergunta nesta ordem, uma por vez, e pula o que o cliente já respondeu. Texto vazio usa o texto do sistema, que se ajusta ao tipo de plano."
        actions={canEdit ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={() => setRows(initialRows(enabledOrder, texts))}>Desfazer</Button>
            <Button size="sm" disabled={!dirty || saving || enabledCount === 0} onClick={save}>{saving ? "Salvando..." : "Salvar fluxo"}</Button>
          </div>
        ) : undefined}
      />
      <ol className="flex flex-col divide-y divide-border/70">
        {rows.map((row, index) => {
          const field = fieldByKey.get(row.key)!;
          const step = steps[index];
          const problem = problems[index];
          return (
            <li key={row.key} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-6 ${row.enabled ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium tabular-nums" aria-hidden="true">{row.enabled ? step : "-"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{field.label}</p>
                  <p className="text-xs text-muted-foreground">{row.enabled ? `${step}ª pergunta` : "Desligada"}</p>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="sr-only" htmlFor={`flow-text-${row.key}`}>Texto da pergunta {field.label}</label>
                <Textarea
                  id={`flow-text-${row.key}`}
                  value={row.text}
                  placeholder={field.defaultText}
                  disabled={!canEdit || !row.enabled}
                  rows={2}
                  maxLength={300}
                  aria-invalid={Boolean(problem)}
                  onChange={(event) => update(index, { text: event.target.value })}
                />
                <p className={`text-xs ${problem ? "text-destructive" : "text-muted-foreground"}`}>
                  {problem ?? (row.text.trim() ? "Texto seu." : "Texto do sistema (deixe vazio para manter).")}
                </p>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-1 sm:pt-1">
                  <Button size="icon" variant="ghost" aria-label={`Subir ${field.label}`} disabled={index === 0} onClick={() => move(index, -1)}><ChevronUpIcon /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Descer ${field.label}`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ChevronDownIcon /></Button>
                  <Switch aria-label={`${row.enabled ? "Desligar" : "Ligar"} ${field.label}`} checked={row.enabled} onCheckedChange={(checked) => update(index, { enabled: Boolean(checked) })} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
