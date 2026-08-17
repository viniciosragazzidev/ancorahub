"use client";

import { useState } from "react";
import { Plus } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ManualLeadForm } from "./manual-lead-form";

type PlanOption = { id: string; name: string; carrierName: string };

export function ManualLeadSheet({ plans, initiallyOpen = false, trigger, open: controlledOpen, onOpenChange }: { plans: PlanOption[]; initiallyOpen?: boolean; trigger?: React.ReactElement; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(initiallyOpen);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  return <Sheet onOpenChange={setOpen} open={open}>{isControlled ? null : <SheetTrigger render={trigger ?? <Button size="sm"><Plus weight="bold" /> Novo lead</Button>} />}<SheetContent><SheetHeader><SheetTitle>Novo lead</SheetTitle><SheetDescription>Cadastre uma indicação ou contato recebido fora de uma campanha.</SheetDescription></SheetHeader><SheetBody><ManualLeadForm plans={plans} /></SheetBody></SheetContent></Sheet>;
}
