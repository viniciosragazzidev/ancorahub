"use client";

import { useActionState, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { Trash } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteLeadAction } from "../actions";
import { useActionDialogLifecycle } from "@/hooks/use-action-dialog-lifecycle";

export function DeleteLeadControl({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(deleteLeadAction, {});

  const handleSuccess = useCallback(() => {
    setOpen(false);
    toast.success("Lead excluído da operação.");
    router.replace("/leads");
  }, [router]);
  const handleError = useCallback((result: typeof state) => {
    if (!result.error) return;
    setVisibleError(result.error);
    toast.error(result.error);
  }, []);
  useActionDialogLifecycle({ state, pending, onSuccess: handleSuccess, onError: handleError });

  return <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen && !pending) setVisibleError(null); }}>
    <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive hover:text-destructive"><Trash className="size-4" />Excluir lead</Button>} />
    <DialogPopup key={open ? "open" : "closed"}>
      <DialogPanel><DialogHeader><DialogTitle>Excluir {leadName} da operação?</DialogTitle><DialogDescription>O lead sai das listas ativas e a IA deixa de responder. O histórico permanece preservado para auditoria.</DialogDescription></DialogHeader>
      <form action={formAction} onSubmit={() => setVisibleError(null)}><input type="hidden" name="leadId" value={leadId} />{visibleError ? <p className="mb-3 text-sm text-destructive">{visibleError}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" variant="destructive" disabled={pending}>{pending ? "Excluindo..." : "Excluir lead"}</Button></DialogFooter></form>
      </DialogPanel></DialogPopup>
  </Dialog>;
}
