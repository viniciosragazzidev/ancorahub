"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoleShortcut } from "@/features/agent-drawer/prompt-builder";

type Props = {
  shortcuts: RoleShortcut[];
  onSelectShortcut: (prompt: string) => void;
};

export function AgentShortcutChips({ shortcuts, onSelectShortcut }: Props) {
  if (!shortcuts || shortcuts.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {shortcuts.map((shortcut) => (
        <button
          key={shortcut.key}
          type="button"
          onClick={() => onSelectShortcut(shortcut.prompt)}
          className="w-full text-left flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card hover:bg-accent/60 transition-colors shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="size-4 text-primary shrink-0 transition-transform group-hover:scale-110" />
            <span className="text-xs font-medium text-foreground truncate">{shortcut.prompt}</span>
          </div>
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground/90 bg-muted px-2 py-0.5 rounded-md border border-border/80">
            {shortcut.key}
          </span>
        </button>
      ))}
    </div>
  );
}
