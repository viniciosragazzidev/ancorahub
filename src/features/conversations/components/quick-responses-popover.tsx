"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listTeamQuickRepliesAction } from "@/features/message-library/actions";
import type { TeamQuickReply } from "@/features/message-library/team-quick-replies";

export type { TeamQuickReply };

const CACHE_MS = 60_000;
let cache: { at: number; replies: TeamQuickReply[] } | null = null;

/**
 * Respostas rápidas da equipe (biblioteca de mensagens), carregadas uma vez e
 * guardadas por 1 minuto para trocar de conversa sem buscar de novo.
 */
export function useTeamQuickReplies() {
  const [replies, setReplies] = useState<TeamQuickReply[]>(() => cache?.replies ?? []);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(() => (cache ? "ready" : "loading"));

  const load = useCallback(async (force = false) => {
    if (!force && cache && Date.now() - cache.at < CACHE_MS) {
      setReplies(cache.replies);
      setStatus("ready");
      return;
    }
    setStatus("loading");
    const result = await listTeamQuickRepliesAction().catch(() => null);
    if (!result?.success) { setStatus("failed"); return; }
    cache = { at: Date.now(), replies: result.replies };
    setReplies(result.replies);
    setStatus("ready");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return { replies, status, retry: () => load(true) };
}

export function QuickResponsesPopover({
  replies,
  status,
  onRetry,
  onSelectResponse,
  disabled,
}: {
  replies: TeamQuickReply[];
  status: "loading" | "ready" | "failed";
  onRetry: () => void;
  onSelectResponse: (reply: TeamQuickReply) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon-sm" type="button" variant="ghost" disabled={disabled} className="text-muted-foreground hover:text-foreground" title="Respostas rápidas" aria-label="Respostas rápidas" />}>
        <Sparkles className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 space-y-1 p-1.5">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
          <span>Respostas rápidas</span>
          <span className="font-normal">Digite / no campo</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {status === "failed" ? (
          <div className="grid gap-2 px-2 py-2 text-sm text-muted-foreground">
            <p>Não foi possível carregar as respostas.</p>
            <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={onRetry}>Tentar de novo</Button>
          </div>
        ) : status === "loading" && !replies.length ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">Carregando…</p>
        ) : !replies.length ? (
          <p className="px-2 py-2 text-sm text-muted-foreground">Nenhuma resposta rápida. Diretor e gestor cadastram em Atendimento, Mensagens.</p>
        ) : (
          replies.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onSelectResponse(item)}
              className="flex min-h-11 cursor-pointer flex-col items-start gap-1 p-2"
            >
              <span className="flex w-full items-center gap-2 text-sm font-medium text-foreground">
                <span className="min-w-0 truncate">{item.title}</span>
                {item.shortcut ? <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">/{item.shortcut}</span> : null}
              </span>
              <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{item.text}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Lista que abre quando o campo começa com "/": setas escolhem, Enter insere, Esc fecha. */
export function SlashQuickReplyMenu({
  id,
  items,
  activeIndex,
  onHover,
  onPick,
}: {
  id: string;
  items: TeamQuickReply[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (reply: TeamQuickReply) => void;
}) {
  if (!items.length) return null;
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Respostas rápidas"
      className="absolute inset-x-0 bottom-full z-50 mb-2 max-h-72 overflow-y-auto rounded-[var(--radius-panel)] border border-border bg-popover p-1.5 text-popover-foreground shadow-[var(--shadow-floating)]"
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          id={`${id}-${index}`}
          role="option"
          aria-selected={index === activeIndex}
          onMouseEnter={() => onHover(index)}
          // mousedown mantém o foco no campo.
          onMouseDown={(event) => { event.preventDefault(); onPick(item); }}
          className="flex min-h-11 cursor-pointer flex-col justify-center gap-0.5 rounded-[calc(var(--radius-panel)-6px)] px-3 py-2 aria-selected:bg-[var(--surface-muted)]"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="min-w-0 truncate">{item.title}</span>
            {item.shortcut ? <span className="ml-auto shrink-0 text-xs font-normal text-muted-foreground">/{item.shortcut}</span> : null}
          </span>
          <span className="line-clamp-1 text-xs text-muted-foreground">{item.text}</span>
        </li>
      ))}
    </ul>
  );
}
