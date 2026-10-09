"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PencilSimple, Plus } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { createDutyTypeAction, setDutyTypeArchivedAction, updateDutyTypeAction } from "@/features/lead-distribution/duty-type-actions";
import { pickDistinctHue, QUEUE_COLOR_SWATCHES } from "@/features/lead-distribution/queue-color";
import { QueueColorDot } from "@/features/lead-distribution/queue-color-tag";
import type { DutyRosterSnapshot } from "@/features/lead-distribution/roster-queries";
import { cn } from "@/lib/utils";
import { DutyTypeTag, MODALITY_LABEL, typeUnitsLabel } from "./duty-type-tag";

export { DutyTypeTag, MODALITY_LABEL, typeColor, typeStripe, typeUnitsLabel } from "./duty-type-tag";

export type DutyTypeOption = DutyRosterSnapshot["types"][number];
type Branch = { id: string; name: string };

type Form = {
  name: string;
  attendanceMode: "online" | "presencial";
  colorHue: number;
  allUnits: boolean;
  branchIds: string[];
  defaultStartsAt: string;
  defaultEndsAt: string;
  defaultMinimumBrokers: string;
  defaultMaximumBrokers: string;
};

/** Create or edit a plantão type: name (the tag), modality, color, units and default hours. */
export function DutyTypeDialog({
  open,
  onOpenChange,
  type,
  branches,
  usedHues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: DutyTypeOption | null;
  branches: readonly Branch[];
  usedHues: readonly (number | null)[];
  onSaved?: (typeId: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>(() => ({
    name: type?.name ?? "",
    attendanceMode: type?.attendanceMode ?? "online",
    colorHue: type?.colorHue ?? pickDistinctHue(usedHues),
    allUnits: !type?.branchIds.length,
    branchIds: type?.branchIds ?? [],
    defaultStartsAt: type?.defaultStartsAt ?? "09:00",
    defaultEndsAt: type?.defaultEndsAt ?? "19:00",
    defaultMinimumBrokers: String(type?.defaultMinimumBrokers ?? 1),
    defaultMaximumBrokers: type?.defaultMaximumBrokers == null ? "" : String(type.defaultMaximumBrokers),
  }));
  const set = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));
  const canSave = form.name.trim().length >= 2 && (form.allUnits || form.branchIds.length > 0);

  function save() {
    const payload = {
      name: form.name,
      attendanceMode: form.attendanceMode,
      colorHue: form.colorHue,
      branchIds: form.allUnits ? [] : form.branchIds,
      defaultStartsAt: form.defaultStartsAt,
      defaultEndsAt: form.defaultEndsAt,
      defaultMinimumBrokers: Number(form.defaultMinimumBrokers) || 1,
      defaultMaximumBrokers: form.defaultMaximumBrokers ? Number(form.defaultMaximumBrokers) : null,
    };
    startTransition(async () => {
      const result = type ? await updateDutyTypeAction(type.id, payload) : await createDutyTypeAction(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(type ? "Tipo de plantão atualizado." : `Tipo ${form.name.trim()} criado.`);
      router.refresh();
      onSaved?.(result.typeId);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{type ? `Editar tipo ${type.name}` : "Novo tipo de plantão"}</DialogTitle>
          <DialogDescription>O tipo é o grupo do plantão (PME, Premium, Extra...). Ele dá a cor, a modalidade e as unidades que participam.</DialogDescription>
        </DialogHeader>
        <DialogPanel className="max-h-[65vh] gap-4 overflow-y-auto">
          <div className="grid gap-1.5">
            <Label htmlFor="duty-type-name">Nome</Label>
            <Input id="duty-type-name" value={form.name} onChange={(event) => set({ name: event.target.value })} placeholder="Ex.: PME" maxLength={60} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Modalidade</p>
            <div role="radiogroup" aria-label="Modalidade" className="grid grid-cols-2 rounded-[var(--radius-card)] border border-border bg-muted/40 p-0.5">
              {(["presencial", "online"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={form.attendanceMode === mode}
                  onClick={() => set({ attendanceMode: mode })}
                  className={cn("rounded-full px-2 py-1.5 text-xs font-medium", form.attendanceMode === mode ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {MODALITY_LABEL[mode]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{form.attendanceMode === "presencial" ? "O corretor precisa estar na unidade dele; o gestor libera cada um." : "O corretor atende de onde estiver."}</p>
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm font-medium">Cor</p>
            <div className="flex flex-wrap gap-1.5">
              {QUEUE_COLOR_SWATCHES.map((hue) => (
                <button
                  key={hue}
                  type="button"
                  aria-pressed={form.colorHue === hue}
                  aria-label={`Cor ${hue}`}
                  onClick={() => set({ colorHue: hue })}
                  className={cn("grid size-7 place-items-center rounded-full border-2", form.colorHue === hue ? "border-foreground" : "border-transparent")}
                >
                  <QueueColorDot hue={hue} className="size-3.5" />
                </button>
              ))}
            </div>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Unidades que participam</legend>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.allUnits} onCheckedChange={(checked) => set({ allUnits: checked === true })} />
              Todas as unidades
            </label>
            {!form.allUnits ? (
              <div className="grid max-h-40 gap-1 overflow-y-auto rounded-[var(--radius-card)] border border-border p-2">
                {branches.map((branch) => (
                  <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-card)] px-2 py-1 text-sm hover:bg-accent/40">
                    <Checkbox
                      checked={form.branchIds.includes(branch.id)}
                      onCheckedChange={(checked) => set({ branchIds: checked === true ? [...new Set([...form.branchIds, branch.id])] : form.branchIds.filter((id) => id !== branch.id) })}
                    />
                    <span className="truncate">{branch.name}</span>
                  </label>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Na escala, só corretores dessas unidades entram nos plantões do tipo. Dá para forçar um de fora, com confirmação.</p>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="duty-type-start">Início padrão</Label>
              <Input id="duty-type-start" type="time" value={form.defaultStartsAt} onChange={(event) => set({ defaultStartsAt: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="duty-type-end">Fim padrão</Label>
              <Input id="duty-type-end" type="time" value={form.defaultEndsAt} onChange={(event) => set({ defaultEndsAt: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="duty-type-min">Mínimo de corretores</Label>
              <Input id="duty-type-min" type="number" min={1} max={99} value={form.defaultMinimumBrokers} onChange={(event) => set({ defaultMinimumBrokers: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="duty-type-max">Máximo (opcional)</Label>
              <Input id="duty-type-max" type="number" min={1} max={99} value={form.defaultMaximumBrokers} onChange={(event) => set({ defaultMaximumBrokers: event.target.value })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Ao criar um plantão do tipo, esses valores já vêm preenchidos. Com turnos, o corte é sempre às 13:30.</p>
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button type="button" onClick={save} disabled={pending || !canSave}>{pending ? "Salvando…" : type ? "Salvar tipo" : "Criar tipo"}</Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

/** The tenant's plantão types, to edit or archive them. */
export function DutyTypesSheet({ open, onOpenChange, types, branches }: { open: boolean; onOpenChange: (open: boolean) => void; types: readonly DutyTypeOption[]; branches: readonly Branch[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<DutyTypeOption | null>(null);
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const usedHues = types.map((type) => type.colorHue);

  function toggleArchived(type: DutyTypeOption) {
    startTransition(async () => {
      const result = await setDutyTypeArchivedAction(type.id, type.status !== "archived");
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(type.status === "archived" ? "Tipo restaurado." : "Tipo arquivado. Os plantões dele continuam como estão.");
      router.refresh();
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Tipos de plantão</SheetTitle>
            <SheetDescription>Cada plantão pertence a um tipo. A cor do tipo aparece no calendário, na escala e no PDF.</SheetDescription>
          </SheetHeader>
          <SheetBody contentClassName="grid content-start gap-3">
            <Button type="button" variant="outline" className="justify-self-start" onClick={() => setCreating(true)}><Plus className="size-3.5" /> Novo tipo</Button>
            {types.length ? (
              <ul className="divide-y divide-border/60 rounded-[var(--radius-card)] border border-border bg-card">
                {types.map((type) => (
                  <li key={type.id} className={cn("flex items-center justify-between gap-3 px-3 py-2.5", type.status === "archived" && "opacity-60")}>
                    <button type="button" className="min-w-0 text-left" onClick={() => setEditing(type)}>
                      <DutyTypeTag name={type.name} hue={type.colorHue} className="text-sm" />
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {MODALITY_LABEL[type.attendanceMode]} · {typeUnitsLabel(type, branches)} · {type.defaultStartsAt}–{type.defaultEndsAt}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {type.status === "archived" ? <Badge variant="outline">Arquivado</Badge> : null}
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Editar ${type.name}`} onClick={() => setEditing(type)}><PencilSimple className="size-4" /></Button>
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => toggleArchived(type)}>{type.status === "archived" ? "Restaurar" : "Arquivar"}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-[var(--radius-card)] border border-dashed border-border p-4 text-xs text-muted-foreground">Nenhum tipo ainda. Crie o primeiro (ex.: PME, Presencial, Online).</p>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
      {creating ? <DutyTypeDialog open onOpenChange={setCreating} branches={branches} usedHues={usedHues} /> : null}
      {editing ? <DutyTypeDialog key={editing.id} open onOpenChange={(next) => { if (!next) setEditing(null); }} type={editing} branches={branches} usedHues={usedHues} /> : null}
    </>
  );
}

