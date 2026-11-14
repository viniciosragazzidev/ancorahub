"use client";

import { Button } from "@/components/arc/button/button";
import type { ChatServerActionName } from "@/components/chat/types";

import type { AgendaNotice as Notice } from "./use-agenda-action";

/** Aviso da última ação da Agenda: resultado com "Desfazer", ou a causa da falha com "Tentar de novo". */
export function AgendaNotice({ notice, busyId, onUndo, onRetry }: {
  notice: Notice | null;
  busyId: string | null;
  onUndo: (name: ChatServerActionName, payload: Record<string, unknown>) => void;
  onRetry: () => void;
}) {
  if (!notice) return null;
  if (notice.tone === "error") {
    return (
      <p className="flex flex-wrap items-center gap-3 rounded-2xl bg-(--surface-muted) px-4 py-3 text-sm text-(--foreground)" role="alert">
        <span>{notice.message}</span>
        <Button size="sm" variant="secondary" loading={busyId === notice.retry.id} disabled={busyId !== null} onClick={onRetry}>Tentar de novo</Button>
      </p>
    );
  }
  const undo = notice.undo;
  return (
    <p className="flex flex-wrap items-center gap-3 rounded-2xl bg-(--surface-muted) px-4 py-3 text-sm text-(--text-secondary)" role="status" aria-live="polite">
      <span>{notice.message}</span>
      {undo ? <Button size="sm" variant="secondary" loading={busyId === "undo"} disabled={busyId !== null} onClick={() => onUndo(undo.name, undo.payload)}>Desfazer</Button> : null}
    </p>
  );
}
