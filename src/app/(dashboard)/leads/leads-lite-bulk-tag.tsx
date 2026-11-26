"use client";

/**
 * "Etiquetar" da barra de lote de /leads (26/11/2026): aplica ou remove uma etiqueta existente da empresa nos leads
 * selecionados. Painel lateral com a escolha (Aplicar ou Remover), a etiqueta e uma única ação primária.
 * Feedback nível 1 (FEEDBACK.md): o resultado só aparece depois do servidor e diz o que mudou, o que já estava
 * assim e o que ficou de fora do escopo; a falha mostra a causa e "Tentar de novo" no próprio botão.
 */
import { useState } from "react";

import { LiteActionButton, LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { bulkSetLeadTagAction } from "@/features/lead-tags/actions";
import { describeBulkLeadTag, type BulkLeadTagMode, type LeadTag } from "@/features/lead-tags/rules";

const MODES: Array<{ id: BulkLeadTagMode; label: string }> = [
  { id: "add", label: "Aplicar" },
  { id: "remove", label: "Remover" },
];

export function LeadsLiteBulkTagPanel({ open, onOpenChange, leadIds, tags, onCommitted }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  tags: LeadTag[];
  onCommitted?: (input: { leadIds: string[]; tag: LeadTag; mode: BulkLeadTagMode }) => void;
}) {
  const count = leadIds.length;
  return (
    <LiteSidePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Etiquetar leads"
      description={`${count} ${count === 1 ? "lead selecionado" : "leads selecionados"}`}
    >
      {open ? <BulkTagForm leadIds={leadIds} tags={tags} onCommitted={onCommitted} /> : null}
    </LiteSidePanel>
  );
}

function BulkTagForm({ leadIds, tags, onCommitted }: { leadIds: string[]; tags: LeadTag[]; onCommitted?: (input: { leadIds: string[]; tag: LeadTag; mode: BulkLeadTagMode }) => void }) {
  const [mode, setMode] = useState<BulkLeadTagMode>("add");
  const [tagId, setTagId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const tag = tags.find((item) => item.id === tagId);

  return (
    <div className={form.form}>
      <div role="group" aria-label="O que fazer" className={page.countTabs}>
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={page.countTab}
            data-active={mode === item.id ? "true" : undefined}
            aria-pressed={mode === item.id}
            onClick={() => { setMode(item.id); setResult(null); }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <LiteSelect
        label="Etiqueta"
        value={tagId}
        onChange={(value) => { setTagId(value); setResult(null); }}
        placeholder="Escolha a etiqueta"
        searchPlaceholder="Buscar etiqueta"
        options={tags.map((item) => ({ value: item.id, label: item.name }))}
      />
      {result ? <p className={sections.note} role="status">{result}</p> : null}
      <div className={form.actions}>
        <LiteActionButton
          key={`${mode}:${tagId}`}
          busyLabel={mode === "add" ? "Aplicando…" : "Removendo…"}
          doneLabel={mode === "add" ? "Aplicada" : "Removida"}
          disabled={!tag || leadIds.length === 0}
          keeps="Os leads continuam com as etiquetas de antes."
          errorFallback="Não consegui alterar as etiquetas agora."
          onAction={async () => {
            if (!tag) return { ok: false, message: "Escolha a etiqueta." };
            const response = await bulkSetLeadTagAction({ leadIds, tagId: tag.id, mode });
            if (!response.success) return { ok: false, message: response.error };
            setResult(describeBulkLeadTag({ tagName: response.data.tag.name, mode, changed: response.data.changed, unchanged: response.data.unchanged, skipped: response.data.skipped }));
            if (response.data.changedLeadIds.length) onCommitted?.({ leadIds: response.data.changedLeadIds, tag: response.data.tag, mode });
            return { ok: true };
          }}
        >
          {mode === "add" ? "Aplicar etiqueta" : "Remover etiqueta"}
        </LiteActionButton>
      </div>
    </div>
  );
}
