"use client";

import { useActionState, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createChecklistTemplateAction,
  toggleChecklistTemplateAction,
  deleteChecklistTemplateAction,
  type ChecklistTemplateWithItems,
  type ChecklistFormState,
} from "@/features/leads/checklist-actions";

interface Props {
  initialTemplates: ChecklistTemplateWithItems[];
}

type ItemInput = {
  id: string;
  question: string;
  answerType: "boolean" | "rating" | "text" | "select";
  options: string[];
  required: boolean;
};

export function FeedbackTemplatesClient({ initialTemplates }: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemInput[]>([
    { id: crypto.randomUUID(), question: "", answerType: "boolean", options: [], required: true },
  ]);

  const [createState, createAction, createPending] = useActionState<ChecklistFormState, FormData>(
    createChecklistTemplateAction,
    {},
  );

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { id: crypto.randomUUID(), question: "", answerType: "boolean", options: [], required: true }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItem = useCallback((id: string, field: keyof ItemInput, value: unknown) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }, []);

  const handleCreate = async (formData: FormData) => {
    formData.set("name", name);
    formData.set("description", description);
    formData.set("items", JSON.stringify(
      items.map((item) => ({
        question: item.question,
        answerType: item.answerType,
        options: item.answerType === "select" ? item.options : undefined,
        required: item.required,
      })),
    ));

    createAction(formData);
    if (createState.success) {
      toast.success("Template criado com sucesso!");
      setEditing(false);
      setName("");
      setDescription("");
      setItems([{ id: crypto.randomUUID(), question: "", answerType: "boolean", options: [], required: true }]);
    }
    if (createState.error) toast.error(createState.error);
  };

  return (
    <div className="space-y-6">
      {templates.length > 0 && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>Novo template</Button>
        </div>
      )}

      {editing && (
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Novo template</CardTitle>
            <CardDescription>Defina as perguntas que o corretor deve responder ao registrar o feedback.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="template-name">Nome do template</Label>
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Check-list de 1º contato"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="template-desc">Descrição</Label>
                  <Input
                    id="template-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Perguntas</Label>
                  <Button type="button" size="xs" variant="outline" onClick={addItem}>
                    + Adicionar pergunta
                  </Button>
                </div>

                {items.map((item, index) => (
                  <div key={item.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
                    <div className="flex-1 min-w-[200px] grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Pergunta {index + 1}</Label>
                      <Input
                        value={item.question}
                        onChange={(e) => updateItem(item.id, "question", e.target.value)}
                        placeholder="Ex.: Conseguiu falar com o cliente?"
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <select
                        className="flex h-8 w-28 rounded-lg border border-input bg-input/30 px-2 text-xs"
                        value={item.answerType}
                        onChange={(e) => updateItem(item.id, "answerType", e.target.value)}
                      >
                        <option value="boolean">Sim/Não</option>
                        <option value="rating">Nota 1-5</option>
                        <option value="text">Texto</option>
                        <option value="select">Seleção</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-1.5 pb-1 text-xs">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(e) => updateItem(item.id, "required", e.target.checked)}
                      />
                      Obrigatória
                    </label>
                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length <= 1}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button disabled={createPending || !name || !items.some((i) => i.question)} type="submit">
                  {createPending ? "Salvando..." : "Criar template"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!editing && templates.length === 0 && (
        <Card className="border-border bg-card shadow-none">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>
            <Button onClick={() => setEditing(true)}>Criar primeiro template</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {templates.map((template) => (
          <form key={template.id} className="rounded-lg border border-border bg-card p-4">
            <input type="hidden" name="templateId" value={template.id} />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{template.name}</h3>
                  <Badge variant={template.active ? "success" : "outline"} className="text-[9px]">
                    {template.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                {template.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  formAction={async (fd: FormData) => {
                    const result = await toggleChecklistTemplateAction({}, fd);
                    if (result.success) toast.success("Template atualizado.");
                    if (result.error) toast.error(result.error);
                  }}
                  size="xs"
                  variant="outline"
                >
                  {template.active ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  formAction={async (fd: FormData) => {
                    const result = await deleteChecklistTemplateAction({}, fd);
                    if (result.success) {
                      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
                      toast.success("Template excluído.");
                    }
                    if (result.error) toast.error(result.error);
                  }}
                  size="xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                >
                  Excluir
                </Button>
              </div>
            </div>

            {template.items.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {template.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-1 rounded-full bg-muted-foreground/30" />
                    <span>{item.question}</span>
                    <Badge variant="outline" className="text-[8px] px-1 py-0">
                      {item.answerType === "boolean" ? "Sim/Não" : item.answerType === "rating" ? "1-5" : item.answerType}
                    </Badge>
                    {item.required && <span className="text-[9px] text-destructive">*</span>}
                  </div>
                ))}
              </div>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
