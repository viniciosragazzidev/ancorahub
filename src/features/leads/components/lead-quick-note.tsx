"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Note } from "@/components/huge-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addLeadNoteAction,
  type LeadNoteState,
} from "@/features/leads/actions";

export function LeadQuickNote({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<LeadNoteState, FormData>(
    addLeadNoteAction,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success("Nota registrada!");
      setOpen(false);
      formRef.current?.reset();
    }
  }, [state.error, state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="h-8 px-2.5 text-xs" size="sm" variant="outline">
            <Note /> Nota
          </Button>
        }
      />
      <DialogPopup className="sm:max-w-md">
        <DialogTitle>Adicionar nota ao lead</DialogTitle>
        <DialogDescription>
          Registre uma observação, follow-up ou informação relevante sobre este
          atendimento.
        </DialogDescription>

        <form ref={formRef} action={action} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <Textarea
            name="content"
            placeholder="Ex: Cliente pediu para retornar amanhã pela manhã..."
            className="min-h-24 resize-none"
            maxLength={2000}
          />

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" disabled={pending} type="submit" size="sm">
              {pending ? "Salvando..." : "Salvar nota"}
            </Button>
            <DialogClose
              render={
                <Button
                  className="flex-1"
                  disabled={pending}
                  type="button"
                  variant="ghost"
                  size="sm"
                >
                  Cancelar
                </Button>
              }
            />
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
