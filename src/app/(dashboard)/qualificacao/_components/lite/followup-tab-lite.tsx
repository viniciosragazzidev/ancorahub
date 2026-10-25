"use client";

/**
 * Aba "Follow-up" do hub de qualificação no visual Lite: as mesmas regras, o mesmo formulário (a regra nasce
 * desligada, como hoje) e as mesmas ações de salvar e remover. Remover pede confirmação Lite.
 */
import { useCallback, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

import { LiteConfirmDialog, LiteSelect } from "@/components/lite/controls";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";

import type { QualificationHubProps } from "../qualification-hub-types";

type Rule = QualificationHubProps["followUpRules"][number];
export type FollowUpDraft = { name: string; trigger: string; delay: number; messageMode: "fixed" | "template" | "ai_generated"; messageText: string };

const TRIGGERS = [
  { value: "qualification_abandoned", label: "Lead abandonou a qualificação" },
  { value: "no_first_response", label: "Sem resposta à 1ª mensagem" },
  { value: "waiting_broker", label: "Aguardando corretor no plantão" },
  { value: "quote_without_response", label: "Cotação enviada sem retorno" },
];
const MODES = [
  { value: "fixed", label: "Mensagem fixa (econômica)" },
  { value: "template", label: "Template oficial (HSM)" },
  { value: "ai_generated", label: "Gerada por IA (custo R$ 0,02)" },
];
const TRIGGER_LABEL = new Map(TRIGGERS.map((item) => [item.value, item.label]));
const MODE_LABEL: Record<string, string> = { fixed: "Mensagem fixa", template: "Template oficial", ai_generated: "Gerada por IA" };

export function FollowUpTabLite({ rules, draft, onDraft, onSubmit, onDelete }: {
  rules: Rule[];
  draft: FollowUpDraft;
  onDraft: (patch: Partial<FollowUpDraft>) => void;
  onSubmit: (event: FormEvent) => void;
  onDelete: (id: string) => void;
}) {
  const [removing, setRemoving] = useState<Rule | null>(null);
  const cancel = useCallback(() => setRemoving(null), []);
  return (
    <>
      <form onSubmit={onSubmit} className={sections.group} aria-labelledby="followup-new-title">
        <div className={sections.row}>
          <div className={sections.rowText}>
            <h2 id="followup-new-title" className={sections.rowTitle}>Nova regra de follow-up</h2>
            <p className={sections.rowDescription}>Mensagens automáticas de retorno por inatividade ou abandono. Respeitam o opt-out e a janela comercial; a regra nasce com o envio automático desligado.</p>
          </div>
        </div>
        <div className={sections.formBody}>
          <div className={sections.fields}>
            <label className={form.field}>
              <span className={form.label}>Nome da regra</span>
              <input className={form.input} value={draft.name} placeholder="Ex.: lead abandonou a qualificação" onChange={(event) => onDraft({ name: event.target.value })} />
            </label>
            <LiteSelect label="Gatilho" value={draft.trigger} options={TRIGGERS} onChange={(value) => onDraft({ trigger: value })} />
            <label className={form.field}>
              <span className={form.label}>Atraso (minutos)</span>
              <input className={form.input} type="number" value={draft.delay} onChange={(event) => onDraft({ delay: Number(event.target.value) })} />
            </label>
          </div>
          <div className={sections.fields}>
            <LiteSelect label="Modo da mensagem" value={draft.messageMode} options={MODES} onChange={(value) => onDraft({ messageMode: value as FollowUpDraft["messageMode"] })} />
            <label className={form.field}>
              <span className={form.label}>Texto da mensagem fixa</span>
              <input className={form.input} value={draft.messageText} onChange={(event) => onDraft({ messageText: event.target.value })} />
            </label>
          </div>
          {draft.messageMode === "ai_generated" ? (
            <div className={sections.notice} data-tone="warning">
              <p className={sections.noticeTitle} data-tone="warning">Aviso de custo</p>
              <p className={sections.note}>Esta regra chama a IA a cada execução (custo estimado de R$ 0,02).</p>
              <div><button type="button" className={page.button} onClick={() => onDraft({ messageMode: "fixed" })}>Usar mensagem fixa (recomendado)</button></div>
            </div>
          ) : null}
          <div>
            <button type="submit" className={page.button}>
              <Plus aria-hidden="true" size={16} />
              Adicionar regra
            </button>
          </div>
        </div>
      </form>
      <section className={sections.group} aria-labelledby="followup-rules-title">
        <div className={sections.row}>
          <h2 id="followup-rules-title" className={sections.rowTitle}>Regras cadastradas ({rules.length})</h2>
        </div>
        {rules.length ? (
          <ul className={sections.list}>
            {rules.map((rule) => (
              <li key={rule.id} className={sections.item}>
                <span className={sections.itemText}>
                  <span className={sections.rowTitle}>{rule.name}</span>
                  <span className={sections.itemSub}>
                    {TRIGGER_LABEL.get(rule.trigger) ?? rule.trigger} · {MODE_LABEL[rule.messageMode] ?? rule.messageMode} · depois de {rule.delayMinutes} min · até {rule.maxAttempts} tentativas · das {rule.allowedStartTime} às {rule.allowedEndTime}
                  </span>
                </span>
                <button type="button" className={page.iconButton} aria-label={`Remover ${rule.name}`} onClick={() => setRemoving(rule)}>
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className={sections.empty}>
            <p className={sections.emptyTitle}>Nenhuma regra ainda</p>
            <p>Cadastre a primeira no formulário acima.</p>
          </div>
        )}
      </section>
      <LiteConfirmDialog
        open={Boolean(removing)}
        title="Remover esta regra?"
        description={removing ? `"${removing.name}" deixa de existir.` : undefined}
        confirmLabel="Remover regra"
        tone="danger"
        onCancel={cancel}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) onDelete(target.id);
        }}
      />
    </>
  );
}
