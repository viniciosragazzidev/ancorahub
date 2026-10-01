"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import { QUEUE_COLOR_SWATCHES } from "@/features/lead-distribution/queue-color";
import { cn } from "@/lib/utils";

import { createLeadTagAction, deleteLeadTagAction, updateLeadTagAction } from "../actions";
import { LEAD_TAG_NAME_MAX, type LeadTag } from "../rules";

/** Drawer where directors and managers keep the tag list: create, rename, recolor, delete. */
export function LeadTagsManager({
  open,
  onOpenChange,
  tags,
  onTagsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: LeadTag[];
  onTagsChange: (tags: LeadTag[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [isPending, startTransition] = useTransition();

  const create = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
      const result = await createLeadTagAction({ name: newName });
      if (!result.success) return void toast.error(result.error);
      onTagsChange([...tags, result.data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setNewName("");
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Tags das conversas</SheetTitle>
          <SheetDescription>Nome e cor de cada tag. Quem atende aplica as tags nas conversas dos leads.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => { event.preventDefault(); create(); }}
          >
            <Input
              value={newName}
              maxLength={LEAD_TAG_NAME_MAX}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nova tag (ex.: Retornar amanhã)"
              aria-label="Nome da nova tag"
              disabled={isPending}
            />
            <Button type="submit" size="icon" variant="outline" aria-label="Criar tag" disabled={isPending || !newName.trim()}>
              <Plus className="size-4" />
            </Button>
          </form>

          {tags.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {tags.map((tag) => (
                <LeadTagRow
                  key={tag.id}
                  tag={tag}
                  onSaved={(saved) => onTagsChange(tags.map((item) => (item.id === saved.id ? saved : item)))}
                  onDeleted={() => onTagsChange(tags.filter((item) => item.id !== tag.id))}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma tag ainda.</p>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function LeadTagRow({ tag, onSaved, onDeleted }: { tag: LeadTag; onSaved: (tag: LeadTag) => void; onDeleted: () => void }) {
  const [name, setName] = useState(tag.name);
  const [isPending, startTransition] = useTransition();

  const save = (next: { name?: string; colorHue?: number }) => {
    const payload = { id: tag.id, name: next.name ?? name, colorHue: next.colorHue ?? tag.colorHue };
    if (payload.name.trim() === tag.name && payload.colorHue === tag.colorHue) return;
    startTransition(async () => {
      const result = await updateLeadTagAction(payload);
      if (!result.success) {
        setName(tag.name);
        return void toast.error(result.error);
      }
      onSaved(result.data);
    });
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteLeadTagAction(tag.id);
      if (!result.success) return void toast.error(result.error);
      toast.success(`Tag "${tag.name}" excluída das conversas.`);
      onDeleted();
    });
  };

  return (
    <li className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <QueueColorDot hue={tag.colorHue} />
        <Input
          value={name}
          maxLength={LEAD_TAG_NAME_MAX}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => save({ name })}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          aria-label={`Nome da tag ${tag.name}`}
          disabled={isPending}
          className="h-8"
        />
        <Button type="button" size="icon-sm" variant="ghost" aria-label={`Excluir a tag ${tag.name}`} onClick={remove} disabled={isPending}>
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 pl-4">
        {QUEUE_COLOR_SWATCHES.map((hue) => (
          <button
            key={hue}
            type="button"
            aria-pressed={tag.colorHue === hue}
            aria-label="Usar esta cor"
            onClick={() => save({ colorHue: hue })}
            disabled={isPending}
            className={cn(
              "grid size-6 place-items-center rounded-full border-2 transition-transform hover:scale-110",
              tag.colorHue === hue ? "border-foreground" : "border-transparent",
            )}
          >
            <QueueColorDot hue={hue} className="size-3.5" />
          </button>
        ))}
      </div>
    </li>
  );
}
