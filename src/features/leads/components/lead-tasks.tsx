"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { CheckCircle, Clock, ListChecks, Plus, Users } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PersonInitials } from "@/components/ui/person-chip";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppSelect } from "@/components/ui/select";
import { LiteActionButton, LiteFilterChips, LiteMenu } from "@/components/lite/controls";
import { createLeadTaskAction, toggleLeadTaskAction, updateLeadTaskAction, type LeadTaskState } from "@/features/leads/task-actions";
import { applyTaskPreset, TASK_PRESETS, taskLocalInputToIso, toTaskLocalInput } from "@/features/leads/task-presets";

type LeadTask = { id: string; title: string; description: string | null; dueAt: string | null; completedAt: string | null; priority: "low" | "normal" | "urgent" };
type Assignee = { id: string; name: string };

export function LeadTasks({ leadId, tasks, assignees }: { leadId: string; tasks: LeadTask[]; assignees: Assignee[] }) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<LeadTask["priority"]>("normal");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(assignees.slice(0, 1).map((assignee) => assignee.id));
  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LeadTask | null>(null);
  const [state, action, pending] = useActionState<LeadTaskState, FormData>(createLeadTaskAction, {});

  function pickPreset(id: string) {
    const preset = TASK_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    // O prazo sai de "agora", no clique; o usuário ainda pode mudar antes de criar.
    const filled = applyTaskPreset(preset, new Date());
    setTitle(filled.title);
    setDueLocal(filled.dueAt);
    setPresetId(id);
  }

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success("Tarefa criada.");
      setOpen(false);
      setPriority("normal");
      setTitle("");
      setDueLocal("");
      setPresetId(null);
      setSelectedAssignees(assignees.slice(0, 1).map((assignee) => assignee.id));
    }
  }, [assignees, state.error, state.success]);

  function toggle(taskId: string) {
    startTransition(async () => {
      const result = await toggleLeadTaskAction(taskId);
      if (result.error) toast.error(result.error);
    });
  }

  function toggleAssignee(assigneeId: string, checked: boolean) {
    setSelectedAssignees((current) => {
      if (!checked) return current.filter((id) => id !== assigneeId);
      if (priority !== "urgent") return [assigneeId];
      return [...current, assigneeId];
    });
  }

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-5 text-primary" />
            Tarefas
          </CardTitle>
          <CardDescription>Próximos passos atribuídos a este atendimento.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm"><Plus /> Nova tarefa</Button>} />
          <DialogPopup key={open ? "open" : "closed"} className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Nova tarefa</DialogTitle>
              <DialogDescription>Registre um próximo passo objetivo para este lead.</DialogDescription>
            </DialogHeader>
            <form action={action} className="grid gap-4">
              <input name="leadId" type="hidden" value={leadId} />
              <LiteFilterChips label="Atalhos de tarefa" chips={TASK_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))} active={presetId ? [presetId] : []} onToggle={pickPreset} />
              <div className="grid gap-2">
                <Label htmlFor="task-title">Título</Label>
                <Input id="task-title" maxLength={160} name="title" placeholder="Ex.: Retornar para confirmar interesse" required value={title} onChange={(event) => { setTitle(event.target.value); setPresetId(null); }} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-description">
                  Descrição <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Textarea id="task-description" maxLength={1000} name="description" placeholder="Contexto que ajuda o corretor a executar a tarefa." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-due">
                  Prazo <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input id="task-due" type="datetime-local" value={dueLocal} onChange={(event) => { setDueLocal(event.target.value); setPresetId(null); }} />
                {/* O campo mostra a hora de São Paulo; o servidor recebe o instante exato. */}
                <input name="dueAt" type="hidden" value={taskLocalInputToIso(dueLocal) ?? ""} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-priority">Prioridade</Label>
                <AppSelect
                  id="task-priority"
                  name="priority"
                  value={priority}
                  onValueChange={(val) => {
                    const next = val as LeadTask["priority"];
                    setPriority(next);
                    if (next !== "urgent") setSelectedAssignees((current) => current.slice(0, 1));
                  }}
                  options={[
                    { value: "low", label: "Baixa" },
                    { value: "normal", label: "Normal" },
                    { value: "urgent", label: "Urgente" },
                  ]}
                />
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <Users className="size-4" /> Responsáveis
                </Label>
                <p className="text-xs text-muted-foreground">
                  {priority === "urgent"
                    ? "Tarefas urgentes podem ter mais de um corretor."
                    : "Tarefas comuns possuem um único responsável."}
                </p>
                <div className="grid gap-2 rounded-lg border border-border p-3">
                  {assignees.map((assignee) => (
                    <label className="flex items-center gap-2 text-sm" key={assignee.id}>
                      <Checkbox
                        checked={selectedAssignees.includes(assignee.id)}
                        onCheckedChange={(checked) => toggleAssignee(assignee.id, Boolean(checked))}
                      />
                      <PersonInitials name={assignee.name} />
                      <span>{assignee.name}</span>
                    </label>
                  ))}
                  {!assignees.length ? (
                    <p className="text-sm text-muted-foreground">Não há corretores ativos disponíveis para este lead.</p>
                  ) : null}
                </div>
                {selectedAssignees.map((assigneeId) => (
                  <input key={assigneeId} name="assigneeIds" type="hidden" value={assigneeId} />
                ))}
              </div>
              <DialogFooter>
                <DialogClose render={<Button disabled={pending} type="button" variant="outline">Cancelar</Button>} />
                <Button disabled={pending || !selectedAssignees.length} type="submit">
                  {pending ? "Criando..." : "Criar tarefa"}
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length ? (
          tasks.map((task) => (
            <div key={task.id} className="flex gap-3 rounded-lg border border-border p-3">
              <Checkbox aria-label={`Concluir ${task.title}`} checked={Boolean(task.completedAt)} onCheckedChange={() => toggle(task.id)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={task.completedAt ? "text-sm font-medium line-through text-muted-foreground" : "text-sm font-medium"}>{task.title}</p>
                  <span
                    className={
                      task.priority === "urgent"
                        ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                        : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {task.priority === "urgent" ? "Urgente" : task.priority === "low" ? "Baixa" : "Normal"}
                  </span>
                </div>
                {task.description ? <p className="mt-1 text-sm text-muted-foreground">{task.description}</p> : null}
                {task.dueAt ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(task.dueAt))}
                  </p>
                ) : null}
              </div>
              {task.completedAt ? <CheckCircle className="size-5 text-emerald-500" /> : null}
              <LiteMenu label={`Ações da tarefa ${task.title}`} items={[{ id: "editar", label: "Editar", onSelect: () => setEditing(task) }]} />
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center">
            <ListChecks className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Nenhuma tarefa pendente</p>
            <p className="mt-1 text-xs text-muted-foreground">Crie um próximo passo para dar continuidade ao atendimento.</p>
          </div>
        )}
      </CardContent>
      <EditLeadTaskDialog task={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

/** Editar tarefa pelo ⋯: só título e prazo. Fecha depois que o servidor confirma. */
function EditLeadTaskDialog({ task, onClose }: { task: LeadTask | null; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [presetId, setPresetId] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDueLocal(task.dueAt ? toTaskLocalInput(new Date(task.dueAt)) : "");
    setPresetId(null);
  }, [task]);

  function pickPreset(id: string) {
    const preset = TASK_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const filled = applyTaskPreset(preset, new Date());
    setTitle(filled.title);
    setDueLocal(filled.dueAt);
    setPresetId(id);
  }

  async function save() {
    if (!task) return { ok: false as const, message: "Tarefa não encontrada." };
    const result = await updateLeadTaskAction(task.id, { title, dueAt: taskLocalInputToIso(dueLocal) });
    if (result.error) return { ok: false as const, message: result.error };
    return { ok: true as const };
  }

  return (
    <Dialog open={Boolean(task)} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
          <DialogDescription>Ajuste o título ou o prazo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <LiteFilterChips label="Atalhos de tarefa" chips={TASK_PRESETS.map((preset) => ({ id: preset.id, label: preset.label }))} active={presetId ? [presetId] : []} onToggle={pickPreset} />
          <div className="grid gap-2">
            <Label htmlFor="task-edit-title">Título</Label>
            <Input id="task-edit-title" maxLength={160} required value={title} onChange={(event) => { setTitle(event.target.value); setPresetId(null); }} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="task-edit-due">
              Prazo <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="task-edit-due" type="datetime-local" value={dueLocal} onChange={(event) => { setDueLocal(event.target.value); setPresetId(null); }} />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline">Cancelar</Button>} />
            <LiteActionButton busyLabel="Salvando..." doneLabel="Tarefa salva" keeps="A tarefa continua como estava." disabled={title.trim().length < 3} onAction={save} onDone={() => { router.refresh(); window.setTimeout(onClose, 600); }}>
              Salvar
            </LiteActionButton>
          </DialogFooter>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
