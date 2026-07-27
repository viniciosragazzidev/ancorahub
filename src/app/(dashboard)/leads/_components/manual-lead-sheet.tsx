"use client";

import { useState } from "react";
import { Plus } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ManualLeadForm } from "./manual-lead-form";

type PlanOption = { id: string; name: string; carrierName: string };

export function ManualLeadSheet({ plans, initiallyOpen = false, trigger }: { plans: PlanOption[]; initiallyOpen?: boolean; trigger?: React.ReactElement }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <Sheet onOpenChange={setOpen} open={open}><SheetTrigger render={trigger ?? <Button><Plus weight="bold" /> Novo lead</Button>} /><SheetContent><SheetHeader><SheetTitle>Novo lead</SheetTitle><SheetDescription>Cadastre uma indicação ou contato recebido fora de uma campanha.</SheetDescription></SheetHeader><SheetBody><ManualLeadForm plans={plans} /></SheetBody></SheetContent></Sheet>;
}
