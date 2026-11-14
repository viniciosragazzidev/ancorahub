"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import { setUnitQueueModeAction } from "@/features/lead-distribution/queue-mode-actions";
import type { UnitQueueMode } from "@/features/lead-distribution/queue-mode";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<UnitQueueMode["mode"], string> = { automatic: "Automática", manual: "Manual" };

/**
 * Gestor (05/11): escolhe, fila por fila da unidade dele, se a distribuição é automática ou manual.
 * Feedback nível 1 (FEEDBACK.md): toque vibra, "Salvando…" na fila, o modo muda depois do servidor e a
 * confirmação fica na própria fila (sem toast); erro com causa, o modo anterior e "Tentar de novo".
 */
export function UnitQueueModeCard({ queues }: { queues: readonly UnitQueueMode[] }) {
  const router = useRouter();
  const [modes, setModes] = useState(() => new Map(queues.map((queue) => [queue.id, queue.mode])));
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const notice = useActionNotice();
  const [noticeQueueId, setNoticeQueueId] = useState<string | null>(null);

  function choose(queueId: string, mode: UnitQueueMode["mode"]) {
    if (modes.get(queueId) === mode || busy) return;
    notice.tap();
    notice.clear();
    setNoticeQueueId(queueId);
    setBusy(queueId);
    const previous = MODE_LABEL[modes.get(queueId) ?? "automatic"].toLocaleLowerCase("pt-BR");
    const failOptions = { fallback: "Não consegui mudar a fila agora", keeps: `A fila continua ${previous}`, retry: () => choose(queueId, mode) };
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof setUnitQueueModeAction>>;
      try {
        result = await setUnitQueueModeAction({ queueId, mode });
      } catch (error) {
        setBusy(null);
        notice.fail(error, failOptions);
        return;
      }
      setBusy(null);
      if (!result.ok) {
        notice.fail(result, failOptions);
        return;
      }
      setModes((current) => new Map(current).set(queueId, mode));
      notice.succeed(mode === "automatic" ? "A fila passou a distribuir automaticamente." : "A fila passou para distribuição manual.");
      router.refresh();
    });
  }

  return (
    <Card variant="overview">
      <CardHeader className="gap-0 border-b border-border/50 p-4">
        <CardTitle className="text-sm font-semibold">Distribuição da fila da unidade</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Automática: o lead vai para o corretor da vez. Manual: o lead espera alguém atribuir.</p>
      </CardHeader>
      <CardContent className="grid gap-2 p-4">
        {queues.length ? queues.map((queue) => {
          const current = modes.get(queue.id) ?? queue.mode;
          return (
            <div key={queue.id} className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium">{queue.name}{busy === queue.id ? <span className="ml-2 text-xs font-normal text-muted-foreground" aria-live="polite">Salvando…</span> : null}</p>
              <div role="radiogroup" aria-label={`Distribuição da fila ${queue.name}`} className="grid grid-cols-2 rounded-[var(--radius-card)] border border-border bg-muted/40 p-0.5">
                {(["automatic", "manual"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={current === mode}
                    disabled={busy !== null}
                    onClick={() => choose(queue.id, mode)}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-60", current === mode ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
              {noticeQueueId === queue.id ? <ActionNoticeLine notice={notice.notice} className="basis-full" /> : null}
            </div>
          );
        }) : <p className="text-xs text-muted-foreground">Sua unidade não tem fila ativa.</p>}
      </CardContent>
    </Card>
  );
}
