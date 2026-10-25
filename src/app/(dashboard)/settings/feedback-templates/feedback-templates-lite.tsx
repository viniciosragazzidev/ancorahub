"use client";

/**
 * Checklists de atendimento no visual Lite. Mesmas Server Actions (criar, ativar ou desativar, excluir), mesmo formato
 * dos itens enviados e as mesmas mensagens. A lista fica num grupo com divisórias; o novo modelo abre no painel lateral
 * e excluir pede confirmação Lite.
 */
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { LiteConfirmDialog, LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { toast } from "@/components/ui/sonner";
import {
  createChecklistTemplateAction,
  deleteChecklistTemplateAction,
  toggleChecklistTemplateAction,
  type ChecklistFormState,
  type ChecklistTemplateWithItems,
} from "@/features/leads/checklist-actions";

type AnswerType = "boolean" | "rating" | "text" | "select";
type ItemInput = { id: string; question: string; answerType: AnswerType; options: string[]; required: boolean };

const ANSWER_OPTIONS = [
  { value: "boolean", label: "Sim ou não" },
  { value: "rating", label: "Nota de 1 a 5" },
  { value: "text", label: "Texto" },
  { value: "select", label: "Seleção" },
];
const ANSWER_LABEL: Record<string, string> = { boolean: "Sim ou não", rating: "Nota 1 a 5", text: "Texto", select: "Seleção" };

export function FeedbackTemplatesLite({ initialTemplates }: { initialTemplates: ChecklistTemplateWithItems[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Ids estáveis por contador (sem aleatório no primeiro render).
  const nextId = useRef(1);
  const newItem = useCallback((): ItemInput => ({ id: `item-${nextId.current++}`, question: "", answerType: "boolean", options: [], required: true }), []);
  const [items, setItems] = useState<ItemInput[]>(() => [{ id: "item-0", question: "", answerType: "boolean", options: [], required: true }]);
  const [removing, setRemoving] = useState<ChecklistTemplateWithItems | null>(null);
  const [rowPending, startRow] = useTransition();
  const cancelRemove = useCallback(() => setRemoving(null), []);

  const [createState, createAction, createPending] = useActionState<ChecklistFormState, FormData>(createChecklistTemplateAction, {});

  useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);

  useEffect(() => {
    if (!createState.success && !createState.error) return;
    if (createState.error) {
      toast.error(createState.error);
      return;
    }
    toast.success("Template criado com sucesso!");
    setEditing(false);
    setName("");
    setDescription("");
    setItems([newItem()]);
    router.refresh();
  }, [createState, router, newItem]);

  const updateItem = (id: string, patch: Partial<ItemInput>) => setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const handleCreate = (formData: FormData) => {
    formData.set("name", name);
    formData.set("description", description);
    formData.set("items", JSON.stringify(items.map((item) => ({ question: item.question, answerType: item.answerType, options: item.answerType === "select" ? item.options : undefined, required: item.required }))));
    createAction(formData);
  };

  const toggle = (template: ChecklistTemplateWithItems) => startRow(async () => {
    const formData = new FormData();
    formData.set("templateId", template.id);
    const result = await toggleChecklistTemplateAction({}, formData);
    if (result.success) {
      toast.success("Template atualizado.");
      router.refresh();
    }
    if (result.error) toast.error(result.error);
  });

  const remove = (template: ChecklistTemplateWithItems) => startRow(async () => {
    const formData = new FormData();
    formData.set("templateId", template.id);
    const result = await deleteChecklistTemplateAction({}, formData);
    if (result.success) {
      setTemplates((prev) => prev.filter((item) => item.id !== template.id));
      toast.success("Template excluído.");
    }
    if (result.error) toast.error(result.error);
  });

  return (
    <>
      <section className={sections.group} aria-labelledby="templates-title">
        <div className={sections.row}>
          <div className={sections.rowText}>
            <h2 id="templates-title" className={sections.rowTitle}>Modelos de checklist</h2>
            <p className={sections.rowDescription}>Perguntas orientadas para o corretor responder ao registrar o feedback do atendimento.</p>
          </div>
          <button type="button" className={page.primaryButton} onClick={() => setEditing(true)}>
            <Plus aria-hidden="true" size={16} />
            Novo modelo
          </button>
        </div>
        {templates.length === 0 ? (
          <div className={sections.empty}>
            <p className={sections.emptyTitle}>Nenhum modelo criado ainda</p>
            <p>Crie o primeiro com &quot;Novo modelo&quot;.</p>
          </div>
        ) : (
          <ul className={sections.list} aria-label="Modelos de checklist">
            {templates.map((template) => (
              <li key={template.id} className={sections.formBody} style={{ gap: 12 }}>
                <div className={sections.footer} style={{ padding: 0 }}>
                  <span className={sections.itemText}>
                    <span className={sections.rowTitle}>{template.name}</span>
                    {template.description ? <span className={sections.rowDescription}>{template.description}</span> : null}
                  </span>
                  <span className={sections.actions} style={{ alignItems: "center", gap: 8 }}>
                    <span className={page.badge} data-tone={template.active ? "success" : undefined}>{template.active ? "Ativo" : "Inativo"}</span>
                    <button type="button" className={page.button} disabled={rowPending} onClick={() => toggle(template)}>{template.active ? "Desativar" : "Ativar"}</button>
                    <button type="button" className={page.iconButton} aria-label={`Excluir ${template.name}`} disabled={rowPending} onClick={() => setRemoving(template)}>
                      <Trash2 aria-hidden="true" size={18} />
                    </button>
                  </span>
                </div>
                {template.items.length ? (
                  <ul className={sections.steps}>
                    {template.items.map((item) => (
                      <li key={item.id}>
                        {item.question} <span className={page.muted}>({ANSWER_LABEL[item.answerType] ?? item.answerType}{item.required ? ", obrigatória" : ""})</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <LiteSidePanel open={editing} onOpenChange={setEditing} title="Novo modelo" description="Defina as perguntas que o corretor responde ao registrar o feedback.">
        <form action={handleCreate} className={form.form}>
          <label className={form.field}>
            <span className={form.label}>Nome do modelo</span>
            <input className={form.input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: checklist do 1º contato" required />
          </label>
          <label className={form.field}>
            <span className={form.label}>Descrição</span>
            <input className={form.input} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" />
          </label>
          {items.map((item, index) => (
            <fieldset key={item.id} className={sections.notice} style={{ border: 0, margin: 0, gap: 12 }}>
              <legend className={form.label} style={{ float: "left", width: "100%", marginBottom: 4 }}>Pergunta {index + 1}</legend>
              <input className={form.input} aria-label={`Texto da pergunta ${index + 1}`} value={item.question} onChange={(event) => updateItem(item.id, { question: event.target.value })} placeholder="Ex.: conseguiu falar com o cliente?" required />
              <LiteSelect label="Tipo de resposta" value={item.answerType} options={ANSWER_OPTIONS} onChange={(value) => updateItem(item.id, { answerType: value as AnswerType })} />
              <div className={sections.footer} style={{ padding: 0 }}>
                <label className={form.check} style={{ paddingLeft: 0 }}>
                  <input type="checkbox" checked={item.required} onChange={(event) => updateItem(item.id, { required: event.target.checked })} />
                  Obrigatória
                </label>
                <button type="button" className={page.button} data-tone="danger" disabled={items.length <= 1} onClick={() => setItems((prev) => prev.filter((entry) => entry.id !== item.id))}>Remover pergunta</button>
              </div>
            </fieldset>
          ))}
          <div>
            <button type="button" className={page.button} onClick={() => setItems((prev) => [...prev, newItem()])}>
              <Plus aria-hidden="true" size={16} />
              Adicionar pergunta
            </button>
          </div>
          <div className={form.actions}>
            <button type="button" className={page.button} onClick={() => setEditing(false)}>Cancelar</button>
            <button type="submit" className={page.primaryButton} disabled={createPending || !name || !items.some((item) => item.question)}>{createPending ? "Salvando..." : "Criar modelo"}</button>
          </div>
        </form>
      </LiteSidePanel>
      <LiteConfirmDialog
        open={Boolean(removing)}
        title="Excluir este modelo?"
        description={removing ? `"${removing.name}" deixa de aparecer no feedback dos corretores.` : undefined}
        confirmLabel="Excluir modelo"
        tone="danger"
        onCancel={cancelRemove}
        onConfirm={() => {
          const target = removing;
          setRemoving(null);
          if (target) remove(target);
        }}
      />
    </>
  );
}
