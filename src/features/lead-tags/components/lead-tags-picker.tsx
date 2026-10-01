"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Settings2, Tag } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";

import { setLeadTagsAction } from "../actions";
import type { LeadTag } from "../rules";
import { LeadTagsManager } from "./lead-tags-manager";

/**
 * The tags of one lead: a "Tags" button opens a searchable list to mark and
 * unmark (saved at once); directors and managers also reach "Gerenciar tags".
 */
export function LeadTagsPicker({
  leadId,
  allTags,
  selected,
  canManage,
  onSelectedChange,
  onAllTagsChange,
}: {
  leadId: string;
  allTags: LeadTag[];
  selected: LeadTag[];
  canManage: boolean;
  onSelectedChange: (tags: LeadTag[]) => void;
  onAllTagsChange: (tags: LeadTag[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedIds = useMemo(() => new Set(selected.map((tag) => tag.id)), [selected]);
  const visible = allTags.filter((tag) => tag.name.toLowerCase().includes(query.trim().toLowerCase()));

  const toggle = (tag: LeadTag) => {
    const next = selectedIds.has(tag.id) ? selected.filter((item) => item.id !== tag.id) : [...selected, tag];
    const previous = selected;
    onSelectedChange(next);
    startTransition(async () => {
      const result = await setLeadTagsAction({ leadId, tagIds: next.map((item) => item.id) });
      if (!result.success) {
        onSelectedChange(previous);
        return void toast.error(result.error);
      }
      onSelectedChange(result.data);
    });
  };

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-xs" aria-label="Tags da conversa">
              <Tag className="size-3.5" />
              Tags{selected.length ? ` (${selected.length})` : ""}
            </Button>
          }
        />
        <PopoverContent className="w-64 p-2" align="end">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar tag"
            aria-label="Buscar tag"
            className="mb-2 h-8"
          />
          <ul className="max-h-60 overflow-y-auto">
            {visible.map((tag) => (
              <li key={tag.id}>
                <button
                  type="button"
                  onClick={() => toggle(tag)}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  aria-pressed={selectedIds.has(tag.id)}
                >
                  <QueueColorDot hue={tag.colorHue} />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {selectedIds.has(tag.id) ? <Check className="size-4 text-primary" /> : null}
                </button>
              </li>
            ))}
            {!visible.length ? (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">
                {allTags.length ? "Nenhuma tag com esse nome." : canManage ? "Nenhuma tag criada ainda." : "Nenhuma tag criada. Peça ao gestor."}
              </li>
            ) : null}
          </ul>
          {canManage ? (
            <Button type="button" variant="ghost" size="sm" className="mt-1 w-full justify-start gap-1.5 text-xs text-muted-foreground" onClick={() => setManagerOpen(true)}>
              <Settings2 className="size-3.5" /> Gerenciar tags
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
      {canManage ? (
        <LeadTagsManager
          open={managerOpen}
          onOpenChange={setManagerOpen}
          tags={allTags}
          onTagsChange={(tags) => {
            onAllTagsChange(tags);
            // A renamed/recolored/deleted tag updates on this lead too.
            onSelectedChange(selected.flatMap((item) => tags.filter((tag) => tag.id === item.id)));
          }}
        />
      ) : null}
    </>
  );
}
