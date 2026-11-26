"use client";

/**
 * "Etiquetas" no visual Lite (25/11): a lista de etiquetas dos leads em tabela, com quantos leads usam cada uma.
 * Clique na linha abre a etiqueta no painel (nome e cor). No ⋯: Renomear, Trocar cor, Juntar com… e Excluir.
 * "Juntar com…" move as atribuições para a outra etiqueta sem duplicar e apaga a de origem; a confirmação diz
 * exatamente de quantos leads ela sai. Mesmas actions do gerenciador em Sheet (src/features/lead-tags), que segue
 * funcionando nas conversas.
 *
 * Feedback (FEEDBACK.md, nível 1): criar, salvar, juntar e excluir confirmam na seção só depois do servidor; a falha
 * mostra a causa, o que continua valendo e "Tentar de novo".
 */
import { useState } from "react";
import { Plus } from "lucide-react";

import { LiteActionButton, LiteConfirmDialog, LiteMenu, LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { QUEUE_COLOR_SWATCHES } from "@/features/lead-distribution/queue-color";
import { createLeadTagAction, deleteLeadTagAction, mergeLeadTagsAction, updateLeadTagAction } from "@/features/lead-tags/actions";
import { describeLeadTagDelete, describeLeadTagMerge, LEAD_TAG_NAME_MAX, normalizeLeadTagName, type LeadTagWithUsage } from "@/features/lead-tags/rules";

import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";

type Panel = { mode: "edit" | "merge"; tagId: string } | null;
type Confirm = { mode: "merge"; sourceId: string; targetId: string } | { mode: "delete"; tagId: string } | null;

const byName = (a: LeadTagWithUsage, b: LeadTagWithUsage) => a.name.localeCompare(b.name, "pt-BR");
const leadsLabel = (count: number) => `${count} ${count === 1 ? "lead" : "leads"}`;

export function TagsLite({ initialTags }: { initialTags: LeadTagWithUsage[] }) {
  const [tags, setTags] = useState(() => [...initialTags].sort(byName));
  const [newName, setNewName] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { status, run, busy } = useActionStatus();

  const panelTag = panel ? tags.find((tag) => tag.id === panel.tagId) ?? null : null;
  const find = (id: string) => tags.find((tag) => tag.id === id);

  function create() {
    const name = normalizeLeadTagName(newName);
    if (!name) return;
    void run("list", async () => {
      const result = await createLeadTagAction({ name });
      if (!result.success) throw new Error(result.error);
      setTags((current) => [...current, { ...result.data, leadCount: 0 }].sort(byName));
      setNewName("");
      return result;
    }, { done: `Etiqueta "${name}" criada.`, fallback: "Não foi possível criar a etiqueta.", keeps: "A lista continua como estava." });
  }

  function merge(sourceId: string, targetId: string) {
    const source = find(sourceId);
    const target = find(targetId);
    if (!source || !target) return;
    setConfirm(null);
    setPanel(null);
    void run("list", async () => {
      const result = await mergeLeadTagsAction({ sourceId, targetId });
      if (!result.success) throw new Error(result.error);
      setTags((current) => current
        .filter((tag) => tag.id !== sourceId)
        .map((tag) => (tag.id === targetId ? { ...tag, leadCount: tag.leadCount + result.data.moved } : tag)));
      return result;
    }, { done: `"${source.name}" juntada com "${target.name}".`, fallback: "Não foi possível juntar as etiquetas.", keeps: "As duas etiquetas continuam como estavam." });
  }

  function remove(tagId: string) {
    const tag = find(tagId);
    if (!tag) return;
    setConfirm(null);
    setPanel(null);
    void run("list", async () => {
      const result = await deleteLeadTagAction(tagId);
      if (!result.success) throw new Error(result.error);
      setTags((current) => current.filter((item) => item.id !== tagId));
      return result;
    }, { done: `Etiqueta "${tag.name}" excluída.`, fallback: "Não foi possível excluir a etiqueta.", keeps: "A etiqueta continua nos leads." });
  }

  const columns: LiteColumn<LeadTagWithUsage>[] = [
    {
      id: "name",
      label: "Nome",
      primary: true,
      render: (tag) => (
        <span className="inline-flex items-center gap-2">
          <QueueColorDot hue={tag.colorHue} />
          <span className={page.cellTitle}>{tag.name}</span>
        </span>
      ),
    },
    { id: "leads", label: "Leads que usam", numeric: true, render: (tag) => (tag.leadCount ? <span className="tabular-nums">{tag.leadCount}</span> : <span className={page.muted}>Nenhum</span>) },
    {
      id: "actions",
      label: "Ações",
      render: (tag) => (
        <LiteMenu
          label={`Ações da etiqueta ${tag.name}`}
          items={[
            { id: "rename", label: "Renomear", onSelect: () => setPanel({ mode: "edit", tagId: tag.id }) },
            { id: "color", label: "Trocar cor", onSelect: () => setPanel({ mode: "edit", tagId: tag.id }) },
            { id: "merge", label: "Juntar com…", onSelect: () => setPanel({ mode: "merge", tagId: tag.id }), disabled: tags.length < 2 },
            { id: "delete", label: "Excluir", tone: "danger", onSelect: () => setConfirm({ mode: "delete", tagId: tag.id }) },
          ]}
        />
      ),
    },
  ];

  const creating = busy("list");
  const confirmSource = confirm?.mode === "merge" ? find(confirm.sourceId) : confirm?.mode === "delete" ? find(confirm.tagId) : undefined;
  const confirmTarget = confirm?.mode === "merge" ? find(confirm.targetId) : undefined;

  return (
    <section className={styles.group} aria-labelledby="tags-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="tags-title" className={styles.rowTitle}>Etiquetas dos leads</h3>
          <p className={styles.rowDescription}>Quem atende aplica as etiquetas nas conversas. Aqui você cuida do nome, da cor e junta as repetidas.</p>
        </div>
      </div>
      <form className={styles.formBody} onSubmit={(event) => { event.preventDefault(); create(); }}>
        <div className="flex flex-wrap items-end gap-2">
          <label className={form.field} style={{ flex: "1 1 220px" }}>
            <span className={form.label}>Nova etiqueta</span>
            <input className={form.input} value={newName} maxLength={LEAD_TAG_NAME_MAX} onChange={(event) => setNewName(event.target.value)} placeholder="Ex.: Retornar amanhã" disabled={creating} />
          </label>
          <button type="submit" className={page.primaryButton} disabled={creating || !normalizeLeadTagName(newName)} aria-busy={creating || undefined}>
            <BusyLabel busy={creating} label="Salvando…">
              <Plus aria-hidden="true" size={16} />
              Criar
            </BusyLabel>
          </button>
        </div>
        <ActionNote status={status.list} />
      </form>
      <LiteResponsiveData
        caption="Etiquetas dos leads"
        columns={columns}
        rows={tags}
        rowKey={(tag) => tag.id}
        onRowOpen={(tag) => setPanel({ mode: "edit", tagId: tag.id })}
        empty={<p className={page.emptyText}>Nenhuma etiqueta ainda.</p>}
      />

      <LiteSidePanel
        open={Boolean(panelTag)}
        onOpenChange={(open) => { if (!open) setPanel(null); }}
        title={panelTag ? (panel?.mode === "merge" ? `Juntar "${panelTag.name}"` : panelTag.name) : "Etiqueta"}
        description={panelTag ? `Em ${leadsLabel(panelTag.leadCount)}` : undefined}
      >
        {panelTag && panel?.mode === "edit" ? (
          <TagEditor
            key={panelTag.id}
            tag={panelTag}
            onSaved={(saved) => setTags((current) => current.map((tag) => (tag.id === saved.id ? { ...tag, ...saved } : tag)).sort(byName))}
          />
        ) : null}
        {panelTag && panel?.mode === "merge" ? (
          <TagMergeChooser
            key={panelTag.id}
            source={panelTag}
            options={tags.filter((tag) => tag.id !== panelTag.id)}
            onChoose={(targetId) => setConfirm({ mode: "merge", sourceId: panelTag.id, targetId })}
          />
        ) : null}
      </LiteSidePanel>

      <LiteConfirmDialog
        open={Boolean(confirm && confirmSource && (confirm.mode === "delete" || confirmTarget))}
        title={confirm?.mode === "merge" ? "Juntar etiquetas?" : "Excluir etiqueta?"}
        description={confirmSource ? (confirm?.mode === "merge" && confirmTarget
          ? describeLeadTagMerge({ sourceName: confirmSource.name, targetName: confirmTarget.name, leaving: confirmSource.leadCount })
          : describeLeadTagDelete({ name: confirmSource.name, leadCount: confirmSource.leadCount })) : undefined}
        confirmLabel={confirm?.mode === "merge" ? "Juntar" : "Excluir"}
        tone={confirm?.mode === "merge" ? "primary" : "danger"}
        onConfirm={() => {
          if (confirm?.mode === "merge") merge(confirm.sourceId, confirm.targetId);
          else if (confirm?.mode === "delete") remove(confirm.tagId);
        }}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}

function TagEditor({ tag, onSaved }: { tag: LeadTagWithUsage; onSaved: (tag: { id: string; name: string; colorHue: number }) => void }) {
  const [name, setName] = useState(tag.name);
  const [hue, setHue] = useState(tag.colorHue);
  const clean = normalizeLeadTagName(name);
  const changed = clean !== tag.name || hue !== tag.colorHue;

  return (
    <div className={form.form}>
      <label className={form.field}>
        <span className={form.label}>Nome</span>
        <input className={form.input} value={name} maxLength={LEAD_TAG_NAME_MAX} onChange={(event) => setName(event.target.value)} />
      </label>
      <fieldset className={form.field}>
        <legend className={form.label}>Cor</legend>
        <div className="flex flex-wrap gap-1">
          {QUEUE_COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-pressed={hue === swatch}
              aria-label={hue === swatch ? "Cor escolhida" : "Usar esta cor"}
              onClick={() => setHue(swatch)}
              className={`grid size-11 place-items-center rounded-full border-2 ${hue === swatch ? "border-(--accent)" : "border-transparent"}`}
            >
              <QueueColorDot hue={swatch} className="size-4" />
            </button>
          ))}
        </div>
      </fieldset>
      <div className={form.actions}>
        <LiteActionButton
          busyLabel="Salvando…"
          doneLabel="Salvo"
          disabled={!clean || !changed}
          keeps="A etiqueta continua com o nome e a cor de antes."
          errorFallback="Não foi possível salvar a etiqueta."
          onAction={async () => {
            const result = await updateLeadTagAction({ id: tag.id, name: clean, colorHue: hue });
            if (!result.success) return { ok: false, message: result.error };
            onSaved(result.data);
            return { ok: true };
          }}
        >
          Salvar
        </LiteActionButton>
      </div>
    </div>
  );
}

function TagMergeChooser({ source, options, onChoose }: { source: LeadTagWithUsage; options: LeadTagWithUsage[]; onChoose: (targetId: string) => void }) {
  const [targetId, setTargetId] = useState("");
  const target = options.find((tag) => tag.id === targetId);
  return (
    <div className={form.form}>
      <p className={styles.note}>Os leads com &quot;{source.name}&quot; passam para a etiqueta escolhida e &quot;{source.name}&quot; é excluída.</p>
      <LiteSelect
        label="Juntar com"
        value={targetId}
        onChange={setTargetId}
        placeholder="Escolha a etiqueta"
        searchPlaceholder="Buscar etiqueta"
        options={options.map((tag) => ({ value: tag.id, label: tag.name, count: tag.leadCount }))}
      />
      {target ? <p className={styles.note}>{describeLeadTagMerge({ sourceName: source.name, targetName: target.name, leaving: source.leadCount })}</p> : null}
      <div className={form.actions}>
        <button type="button" className={page.primaryButton} disabled={!target} onClick={() => target && onChoose(target.id)}>Juntar</button>
      </div>
    </div>
  );
}
