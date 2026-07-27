"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Calculator, Plus, Trash } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createQuoteAction, type QuoteActionState } from "@/features/quotes/actions";
import { formatCurrency } from "@/features/quotes/utils";

type QuoteItem = {
  planId: string;
  planName: string;
  monthlyPrice: number;
  recommended: boolean;
};

type QuoteLineItem = {
  beneficiaryId: string;
  beneficiaryName: string;
  planId: string;
  planName: string;
  calculatedValue: number;
  ageAtQuote: number;
};

type QuoteBuilderProps = {
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  beneficiaries?: Array<{ id: string; name: string; age?: number }>;
  plans?: Array<{ id: string; name: string; monthlyPrice?: number }>;
};

export function QuoteBuilder({
  leadId,
  leadName,
  leadPhone,
  beneficiaries = [],
  plans = [],
}: QuoteBuilderProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<QuoteActionState, FormData>(
    createQuoteAction,
    {},
  );

  const justCreated = Boolean(state.success && state.token);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (justCreated) {
      toast.success("Cotação criada! Compartilhe o link com o cliente.");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors lead-quick-note.tsx pattern
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state.error, justCreated]);

  const totalMonthly = items.reduce((acc, item) => acc + item.monthlyPrice, 0)
    + lineItems.reduce((acc, item) => acc + item.calculatedValue, 0);

  function addItem() {
    setItems([
      ...items,
      { planId: "", planName: "", monthlyPrice: 0, recommended: false },
    ]);
  }

  function addLineItem() {
    if (beneficiaries.length === 0) return;
    setLineItems([
      ...lineItems,
      {
        beneficiaryId: beneficiaries[0].id,
        beneficiaryName: beneficiaries[0].name,
        planId: "",
        planName: "",
        calculatedValue: 0,
        ageAtQuote: beneficiaries[0].age ?? 0,
      },
    ]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof QuoteItem, value: string | number | boolean) {
    const next = [...items];
    if (field === "planId") {
      const plan = plans.find((p) => p.id === value);
      next[index] = {
        ...next[index],
        planId: value as string,
        planName: plan?.name ?? "",
        monthlyPrice: plan?.monthlyPrice ?? next[index].monthlyPrice,
      };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setItems(next);
  }

  function updateLineItem(index: number, field: keyof QuoteLineItem, value: string | number) {
    const next = [...lineItems];
    if (field === "beneficiaryId") {
      const ben = beneficiaries.find((b) => b.id === value);
      next[index] = {
        ...next[index],
        beneficiaryId: value as string,
        beneficiaryName: ben?.name ?? "",
      };
    } else if (field === "planId") {
      const plan = plans.find((p) => p.id === value);
      next[index] = {
        ...next[index],
        planId: value as string,
        planName: plan?.name ?? "",
      };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setLineItems(next);
  }

  const hasData = items.length > 0 || lineItems.length > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="h-8 px-2.5 text-xs" size="sm" variant="outline">
            <Calculator /> Montar cotação
          </Button>
        }
      />
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Montar cotação</SheetTitle>
          <SheetDescription>
            Monte uma proposta para <strong>{leadName}</strong>. Adicione planos e
            valores para gerar o link de compartilhamento.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          <form ref={formRef} id="quote-builder-form" action={action} className="space-y-5">
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="leadName" value={leadName} />
            {leadPhone && <input type="hidden" name="leadPhone" value={leadPhone} />}
            <input type="hidden" name="totalMonthly" value={totalMonthly} />
            <input type="hidden" name="beneficiaryCount" value={lineItems.length || items.length} />
            <input type="hidden" name="items" value={JSON.stringify(items.filter(i => i.planId))} />
            <input type="hidden" name="lineItems" value={JSON.stringify(lineItems.filter(i => i.planId))} />

            {/* Plan Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Planos
                </Label>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={addItem}>
                  <Plus className="size-3" /> Adicionar
                </Button>
              </div>

              {items.length === 0 && lineItems.length === 0 && (
                <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  Nenhum plano adicionado. Clique em &quot;Adicionar&quot; para começar.
                </p>
              )}

              {items.map((item, index) => (
                <div key={index} className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Plano {index + 1}</span>
                    <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => removeItem(index)}>
                      <Trash className="size-3" />
                    </Button>
                  </div>
                  <select
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                    value={item.planId}
                    onChange={(e) => updateItem(index, "planId", e.target.value)}
                  >
                    <option value="">Selecione um plano</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} {plan.monthlyPrice ? `- ${formatCurrency(plan.monthlyPrice)}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px] text-muted-foreground">Valor mensal</Label>
                      <CurrencyInput
                        className="h-8 text-xs"
                        value={String(item.monthlyPrice || "")}
                        onChange={(v) => updateItem(index, "monthlyPrice", parseFloat(v) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={item.recommended}
                          onChange={(e) => updateItem(index, "recommended", e.target.checked)}
                          className="rounded border-border"
                        />
                        Recomendado
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Line Items (per beneficiary) */}
            {beneficiaries.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Por beneficiário
                  </Label>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={addLineItem}>
                    <Plus className="size-3" /> Adicionar
                  </Button>
                </div>

                {lineItems.map((item, index) => (
                  <div key={index} className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">{item.beneficiaryName || `Beneficiário ${index + 1}`}</span>
                      <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => removeLineItem(index)}>
                        <Trash className="size-3" />
                      </Button>
                    </div>
                    <select
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                      value={item.beneficiaryId}
                      onChange={(e) => updateLineItem(index, "beneficiaryId", e.target.value)}
                    >
                      {beneficiaries.map((ben) => (
                        <option key={ben.id} value={ben.id}>{ben.name}{ben.age ? ` (${ben.age} anos)` : ""}</option>
                      ))}
                    </select>
                    <select
                      className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                      value={item.planId}
                      onChange={(e) => updateLineItem(index, "planId", e.target.value)}
                    >
                      <option value="">Selecione um plano</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-[10px] text-muted-foreground">Valor mensal</Label>
                        <CurrencyInput
                          className="h-8 text-xs"
                          value={String(item.calculatedValue || "")}
                          onChange={(v) => updateLineItem(index, "calculatedValue", parseFloat(v) || 0)}
                          placeholder="0,00"
                        />
                      </div>
                      <div className="w-20">
                        <Label className="text-[10px] text-muted-foreground">Idade</Label>
                        <Input
                          type="number"
                          min="0"
                          className="h-8 text-xs"
                          value={item.ageAtQuote || ""}
                          onChange={(e) => updateLineItem(index, "ageAtQuote", parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observações
              </Label>
              <Textarea
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas sobre esta cotação..."
                className="min-h-16 resize-none text-xs"
                maxLength={2000}
              />
            </div>

            {/* Total */}
            {totalMonthly > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                <p className="text-xs text-muted-foreground">Valor mensal total</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(totalMonthly)}</p>
              </div>
            )}
          </form>
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            disabled={pending || !hasData}
            form="quote-builder-form"
            type="submit"
          >
            {pending ? "Criando..." : "Criar cotação"}
          </Button>
          <SheetClose
            render={
              <Button className="w-full" variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            }
          />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
