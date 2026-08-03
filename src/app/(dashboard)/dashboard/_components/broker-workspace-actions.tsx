"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { ArrowRight, CheckCircle } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { ContextNote } from "@/components/ui/context-note";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { quickReminderAction } from "@/features/leads/reminder-actions";
import { toggleLeadTaskAction, type LeadTaskState } from "@/features/leads/task-actions";
import { useLocalFirstMutation } from "@/utils/local-first/use-local-first-mutation";

type Viewer = BrokerWorkspaceData["viewer"];
type NextAction = NonNullable<BrokerWorkspaceData["nextAction"]>;

function queryKeys(viewer: Viewer) {
  return [["broker-workspace", viewer.tenantId, viewer.userId]] as const;
}

function actionLabel(action: NextAction) {
  if (action.kind === "awaiting_response") return "Responder agora";
  if (action.kind === "task_overdue" || action.kind === "return_due") return "Abrir tarefa";
  return "Abrir atendimento";
}

export function BrokerWorkspaceActionButtons({ nextAction, viewer }: { nextAction: NextAction; viewer: Viewer }) {
  const [completed, setCompleted] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const completeTask = useLocalFirstMutation<LeadTaskState, string, boolean>({
    mutationFn: async (taskId) => {
      const result = await toggleLeadTaskAction(taskId);
      if (result.error || !result.success) throw new Error(result.error ?? "Não foi possível concluir a tarefa.");
      return result;
    },
    queryKeys: queryKeys(viewer),
    onOptimistic: () => {
      const snapshot = completed;
      setCompleted(true);
      return snapshot;
    },
    onRollback: (snapshot) => setCompleted(snapshot ?? false),
    onConfirmed: () => toast.success("Tarefa concluída. A fila será atualizada."),
  });
  const deferAction = useLocalFirstMutation<{ success?: boolean; error?: string }, string, boolean>({
    mutationFn: async (leadId) => {
      const formData = new FormData();
      formData.set("leadId", leadId);
      formData.set("when", "tomorrow");
      const result = await quickReminderAction({}, formData);
      if (result.error || !result.success) throw new Error(result.error ?? "Não foi possível agendar o retorno.");
      return result;
    },
    queryKeys: queryKeys(viewer),
    onOptimistic: () => {
      const snapshot = deferred;
      setDeferred(true);
      return snapshot;
    },
    onRollback: (snapshot) => setDeferred(snapshot ?? false),
    onConfirmed: () => toast.success("Retorno agendado para amanhã."),
  });

  return <div className="grid gap-2"><div className="flex flex-wrap gap-2"><Button render={<Link href={nextAction.href} />} size="sm">{actionLabel(nextAction)} <ArrowRight aria-hidden="true" /></Button>{nextAction.taskId ? <Button disabled={completeTask.isPending || completed} onClick={() => completeTask.mutate(nextAction.taskId!)} size="sm" variant="outline"><CheckCircle aria-hidden="true" /> {completed ? "Concluída" : "Concluir"}</Button> : <Button disabled={deferAction.isPending || deferred} onClick={() => deferAction.mutate(nextAction.leadId)} size="sm" variant="outline">{deferred ? "Retorno agendado" : "Adiar para amanhã"}</Button>}</div>{(completeTask.syncError || deferAction.syncError) ? <ContextNote title="Não foi possível sincronizar" variant="error">A alteração local foi desfeita. Tente novamente.</ContextNote> : null}</div>;
}

export function BrokerWorkspaceTaskCompleteButton({ taskId, taskTitle, viewer }: { taskId: string; taskTitle: string; viewer: Viewer }) {
  const [completed, setCompleted] = useState(false);
  const mutation = useLocalFirstMutation<LeadTaskState, string, boolean>({
    mutationFn: async (id) => {
      const result = await toggleLeadTaskAction(id);
      if (result.error || !result.success) throw new Error(result.error ?? "Não foi possível concluir a tarefa.");
      return result;
    },
    queryKeys: queryKeys(viewer),
    onOptimistic: () => {
      const snapshot = completed;
      setCompleted(true);
      return snapshot;
    },
    onRollback: (snapshot) => setCompleted(snapshot ?? false),
    onConfirmed: () => toast.success("Tarefa concluída. A agenda será atualizada."),
  });

  return <Button aria-label={completed ? `${taskTitle} concluída` : `Concluir ${taskTitle}`} disabled={mutation.isPending || completed} onClick={() => mutation.mutate(taskId)} size="icon" variant="ghost"><CheckCircle aria-hidden="true" className="size-4" /></Button>;
}
