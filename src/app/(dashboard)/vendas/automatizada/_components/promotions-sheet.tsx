"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetSection, SheetSectionHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { listAutoSalePromotionsAction, saveAutoSalePromotionAction } from "@/features/auto-sale/actions";

type Promotion = { id: string; operator: string; title: string; description: string; startsOn: string; endsOn: string; active: boolean };
const br = (value: string) => value.split("-").reverse().join("/");

/** Promoções vigentes (D9): a assistente só cita o que estiver aqui, ativo e no prazo. */
export function PromotionsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [items, setItems] = useState<Promotion[]>([]);
  const [form, setForm] = useState({ operator: "", title: "", description: "", startsOn: "", endsOn: "" });
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await listAutoSalePromotionsAction();
      if (result.ok) setItems(result.data);
    });
  }, [open]);

  const save = () => startTransition(async () => {
    const result = await saveAutoSalePromotionAction({ op: "create", ...form });
    if (!result.ok) { toast.error(result.error); return; }
    setItems(result.data);
    setForm({ operator: "", title: "", description: "", startsOn: "", endsOn: "" });
    toast.success("Promoção cadastrada.");
  });
  const deactivate = (promotionId: string) => startTransition(async () => {
    const result = await saveAutoSalePromotionAction({ op: "deactivate", promotionId });
    if (!result.ok) { toast.error(result.error); return; }
    setItems(result.data);
  });

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label htmlFor={`promo-${key}`}>{label}</Label>
      <Input id={`promo-${key}`} type={type} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,34rem)]">
        <SheetHeader>
          <SheetTitle>Promoções vigentes</SheetTitle>
          <SheetDescription>A assistente só fala em promoção, desconto ou brinde se houver uma ativa aqui, e sempre com a data de fim.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <SheetSection>
            <SheetSectionHeader><p className="text-sm font-medium">Nova promoção</p></SheetSectionHeader>
            <div className="grid gap-3 p-4">
              {field("operator", "Operadora")}
              {field("title", "Título (ex.: 50% na 1ª mensalidade)")}
              {field("description", "Condição em uma frase")}
              <div className="grid grid-cols-2 gap-3">{field("startsOn", "Início", "date")}{field("endsOn", "Fim", "date")}</div>
            </div>
          </SheetSection>
          <SheetSection>
            <SheetSectionHeader><p className="text-sm font-medium">Cadastradas</p></SheetSectionHeader>
            <ul className="grid gap-2 p-4">
              {items.length ? items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-border p-3">
                  <span className="grid gap-0.5 text-sm">
                    <span className="font-medium">{item.operator}: {item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.description} {br(item.startsOn)} a {br(item.endsOn)}{item.active ? "" : ", desativada"}</span>
                  </span>
                  {item.active ? <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => deactivate(item.id)}>Desativar</Button> : null}
                </li>
              )) : <li className="text-sm text-muted-foreground">Nenhuma promoção cadastrada.</li>}
            </ul>
          </SheetSection>
        </SheetBody>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button type="button" disabled={pending || !form.operator || !form.title || !form.description || !form.startsOn || !form.endsOn} onClick={save}>Cadastrar promoção</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
