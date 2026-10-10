"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { acknowledgeAction, markInboxReadAction } from "../actions";
import type { BroadcastKind } from "../service";

type MuralItem = { id: string; kind: BroadcastKind; title: string; body: string; requireAck: boolean; createdAt: string; senderName: string; readAt: string | null; ackAt: string | null };

const KIND_LABEL: Record<BroadcastKind, string> = { notice: "Aviso", recognition: "Reconhecimento", confirmation: "Pede confirmação" };
const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** The broker side of the Central: messages from the management, with "Ciente" when asked. */
export function BrokerMural({ items: initial }: { items: MuralItem[] }) {
  const [items, setItems] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // What was new when the mural opened keeps its marker while the broker reads.
  const [unreadAtOpen] = useState(() => new Set(initial.filter((item) => !item.readAt).map((item) => item.id)));

  useEffect(() => {
    if (unreadAtOpen.size) void markInboxReadAction();
  }, [unreadAtOpen]);

  function acknowledge(id: string) {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const result = await acknowledgeAction(id);
      setPendingId(null);
      if (!result.ok) { setError(result.error); return; }
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ackAt: now, readAt: item.readAt ?? now } : item)));
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-lg font-medium text-foreground">Mural da gestão</h1>
        <p className="text-sm text-muted-foreground">Avisos e reconhecimentos que a gestão mandou para você.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {!items.length ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma mensagem por enquanto. Quando a gestão mandar algo, aparece aqui e na conversa da Âncora.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "space-y-2 rounded-xl border bg-card p-4",
                item.kind === "recognition" ? "border-success/40" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.senderName} · {dateTime.format(new Date(item.createdAt))}</p>
                </div>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {unreadAtOpen.has(item.id) ? <span className="size-2 rounded-full bg-primary" aria-label="Nova" /> : null}
                  {KIND_LABEL[item.kind]}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-foreground">{item.body}</p>
              {item.requireAck ? (
                item.ackAt ? (
                  <p className="text-xs text-success">Você confirmou em {dateTime.format(new Date(item.ackAt))}</p>
                ) : (
                  <Button type="button" size="sm" onClick={() => acknowledge(item.id)} disabled={pendingId === item.id}>
                    {pendingId === item.id ? "Confirmando..." : "Ciente"}
                  </Button>
                )
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
