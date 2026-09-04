"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { ArrowRight, CheckCircle } from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { ContextNote } from "@/components/ui/context-note";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { toggleLeadTaskAction } from "@/features/leads/task-actions";

type Viewer = BrokerWorkspaceData["viewer"];
type NextAction = NonNullable<BrokerWorkspaceData["nextAction"]>;

function actionLabel(action: NextAction) {
  if (action.kind === "awaiting_response") return "Responder agora";
  if (action.kind === "task_overdue" || action.kind === "return_due") return "Abrir tarefa";
  return "Abrir atendimento";
}

export function BrokerWorkspaceActionButtons({ nextAction, viewer: _viewer }: { nextAction: NextAction; viewer: Viewer }) {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [pending, setPending] = useState(false);

  async function completeTask() {
    if (!nextAction.taskId || pending) return;
    const snapshot = completed;
    setPending(true);
    setSyncError(false);
    setCompleted(true);
    try {
      const result = await toggleLeadTaskAction(nextAction.taskId);
      if (result.error || !result.success) throw new Error(result.error ?? "Não foi possível concluir a tarefa.");
      toast.success("Tarefa concluída. A fila será atualizada.");
      router.refresh();
    } catch {
      setCompleted(snapshot);
      setSyncError(true);
    } finally {
      setPending(false);
    }
  }

  return <div className="grid gap-2"><div className="flex flex-wrap gap-2"><Link href={nextAction.href} className={buttonVariants({ size: "sm" })}>{actionLabel(nextAction)} <ArrowRight aria-hidden="true" /></Link>{nextAction.taskId ? <Button disabled={pending || completed} onClick={completeTask} size="sm" variant="outline"><CheckCircle aria-hidden="true" /> {completed ? "Concluída" : "Concluir"}</Button> : null}</div>{syncError ? <ContextNote title="Não foi possível sincronizar" variant="error">A alteração local foi desfeita. Tente novamente.</ContextNote> : null}</div>;
}

export function BrokerWorkspaceTaskCompleteButton({ taskId, taskTitle }: { taskId: string; taskTitle: string; viewer: Viewer }) {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);
  const [pending, setPending] = useState(false);

  async function completeTask() {
    if (pending) return;
    const snapshot = completed;
    setPending(true);
    setCompleted(true);
    try {
      const result = await toggleLeadTaskAction(taskId);
      if (result.error || !result.success) throw new Error(result.error ?? "Não foi possível concluir a tarefa.");
      toast.success("Tarefa concluída. A agenda será atualizada.");
      router.refresh();
    } catch {
      setCompleted(snapshot);
      toast.error("Não foi possível concluir a tarefa. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return <Button aria-label={completed ? `${taskTitle} concluída` : `Concluir ${taskTitle}`} disabled={pending || completed} onClick={completeTask} size="icon" variant="ghost"><CheckCircle aria-hidden="true" className="size-4" /></Button>;
}
