"use client";

/**
 * Fluxo de atendimento no visual Lite: as mesmas perguntas, ordem, textos e validação da tela atual, com a mesma
 * Server Action. Só quem pode editar (`canEdit`, como hoje) reordena, liga, desliga e salva; as alterações pendentes
 * aparecem numa barra flutuante com "Desfazer" e "Salvar fluxo".
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

import { Switch } from "@/components/arc/switch/switch";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import type { QualificationFieldKey } from "@/features/qualification-engine/reply-composer";
import { saveQualificationFlowAction } from "@/features/qualification-flow/actions";
import { QUALIFICATION_FIELDS, questionTextProblem } from "@/features/qualification-flow/domain";

import styles from "./flow-editor-lite.module.css";

type Row = { key: QualificationFieldKey; enabled: boolean; text: string };

const fieldByKey = new Map(QUALIFICATION_FIELDS.map((field) => [field.key, field]));

function initialRows(enabledOrder: QualificationFieldKey[], texts: Partial<Record<QualificationFieldKey, string>>): Row[] {
  const off = QUALIFICATION_FIELDS.map((field) => field.key).filter((key) => !enabledOrder.includes(key));
  return [...enabledOrder.map((key) => ({ key, enabled: true })), ...off.map((key) => ({ key, enabled: false }))].map((row) => ({ ...row, text: texts[row.key] ?? "" }));
}

export function FlowEditorLite({ enabledOrder, texts, canEdit }: { enabledOrder: QualificationFieldKey[]; texts: Partial<Record<QualificationFieldKey, string>>; canEdit: boolean }) {
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
      const result = await saveQualificationFlowAction({ order: rows.filter((row) => row.enabled).map((row) => row.key), texts: Object.fromEntries(rows.map((row) => [row.key, row.text])) });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Fluxo salvo. Vale para as próximas conversas da IA.");
      router.refresh();
    });
  }

  const steps = rows.map((row, index) => (row.enabled ? rows.slice(0, index + 1).filter((item) => item.enabled).length : 0));
  return (
    <>
      <section className={page.group} aria-labelledby="flow-title">
        <header className={page.cardHead}>
          <h2 id="flow-title" className={page.cardTitle}>Perguntas da qualificação ({enabledCount} ligadas)</h2>
          <p className={page.cardDescription}>A IA pergunta nesta ordem, uma por vez, e pula o que o cliente já respondeu. Texto vazio usa o texto do sistema, que se ajusta ao tipo de plano.</p>
        </header>
        <ol className={styles.list}>
          {rows.map((row, index) => {
            const field = fieldByKey.get(row.key)!;
            const step = steps[index];
            const problem = problems[index];
            return (
              <li key={row.key} className={styles.row} data-off={row.enabled ? undefined : "true"}>
                <div className={styles.label}>
                  <span className={styles.step} aria-hidden="true">{row.enabled ? step : "-"}</span>
                  <span className={styles.labelText}>
                    <span className={page.cellTitle}>{field.label}</span>
                    <span className={page.cellSub}>{row.enabled ? `${step}ª pergunta` : "Desligada"}</span>
                  </span>
                </div>
                <div className={form.field}>
                  <label className="sr-only" htmlFor={`flow-lite-${row.key}`}>Texto da pergunta {field.label}</label>
                  <textarea
                    id={`flow-lite-${row.key}`}
                    className={form.textarea}
                    style={{ minHeight: 72 }}
                    value={row.text}
                    placeholder={field.defaultText}
                    disabled={!canEdit || !row.enabled}
                    rows={2}
                    maxLength={300}
                    aria-invalid={Boolean(problem)}
                    onChange={(event) => update(index, { text: event.target.value })}
                  />
                  <p className={form.hint} style={problem ? { color: "var(--danger)" } : undefined}>
                    {problem ?? (row.text.trim() ? "Texto seu." : "Texto do sistema (deixe vazio para manter).")}
                  </p>
                </div>
                {canEdit ? (
                  <div className={styles.controls}>
                    <button type="button" className={page.iconButton} aria-label={`Subir ${field.label}`} disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp aria-hidden="true" size={18} /></button>
                    <button type="button" className={page.iconButton} aria-label={`Descer ${field.label}`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}><ChevronDown aria-hidden="true" size={18} /></button>
                    <span className={styles.switch}>
                      <Switch aria-label={`${row.enabled ? "Desligar" : "Ligar"} ${field.label}`} checked={row.enabled} onCheckedChange={(checked) => update(index, { enabled: Boolean(checked) })} />
                    </span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
      {canEdit && dirty ? (
        <div role="region" aria-label="Alterações não salvas" className={styles.bar}>
          <span className={styles.barText}>Alterações não salvas</span>
          <span className={styles.barActions}>
            <button type="button" className={page.button} disabled={saving} onClick={() => setRows(initialRows(enabledOrder, texts))}>Desfazer</button>
            <button type="button" className={page.primaryButton} disabled={saving || enabledCount === 0} onClick={save}>{saving ? "Salvando..." : "Salvar fluxo"}</button>
          </span>
        </div>
      ) : null}
    </>
  );
}
