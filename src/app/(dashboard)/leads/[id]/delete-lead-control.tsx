"use client";

import { useActionState, useState } from "react";
import { Trash } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteLeadAction } from "../actions";

export function DeleteLeadControl({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteLeadAction, {});

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="size-4" />Excluir lead</Button>} />
    <DialogPopup key={open ? "open" : "closed"}>
      <DialogPanel><DialogHeader><DialogTitle>Excluir {leadName} da operação?</DialogTitle><DialogDescription>O lead sai das listas ativas e a IA deixa de responder. O histórico permanece preservado para auditoria.</DialogDescription></DialogHeader>
      <form action={formAction}><input type="hidden" name="leadId" value={leadId} />{state.error ? <p className="mb-3 text-sm text-destructive">{state.error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Excluindo..." : "Excluir lead"}</Button></DialogFooter></form>
      </DialogPanel></DialogPopup>
  </Dialog>;
}
