"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarBlank, Clock, Bell } from "@/components/huge-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  quickReminderAction,
  type ReminderState,
} from "@/features/leads/reminder-actions";

function getTomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function LeadReminder({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<"today" | "tomorrow" | "custom">();
  const formRef = useRef<HTMLFormElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<ReminderState, FormData>(
    quickReminderAction,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) {
      toast.success("Lembrete agendado!");
      setOpen(false);
      setSelected(undefined);
    }
  }, [state.error, state.success]);

  function submitPreset(when: "today" | "tomorrow") {
    setSelected(when);
    if (hiddenRef.current && formRef.current) {
      hiddenRef.current.value = when;
      formRef.current.requestSubmit();
    }
  }

  function handleCustomChange(value: string) {
    setSelected("custom");
    if (hiddenRef.current) hiddenRef.current.value = value;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="h-8 px-2.5 text-xs" size="sm" variant="outline">
            <Bell /> Lembrete
          </Button>
        }
      />
      <DialogPopup className="sm:max-w-sm">
        <DialogTitle>Agendar lembrete de retorno</DialogTitle>
        <DialogDescription>
          Crie uma tarefa para lembrar de retornar o contato com este lead.
        </DialogDescription>

        <form ref={formRef} action={action} className="space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <input ref={hiddenRef} type="hidden" name="when" />

          {/* Preset buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={[
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-left transition-all",
                selected === "today"
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted",
              ].join(" ")}
              onClick={() => submitPreset("today")}
            >
              <Clock className="size-4" />
              <span className="text-xs font-medium">Hoje</span>
              <span className="text-[10px] text-muted-foreground">as 18h</span>
            </button>
            <button
              type="button"
              className={[
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-left transition-all",
                selected === "tomorrow"
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted",
              ].join(" ")}
              onClick={() => submitPreset("tomorrow")}
            >
              <CalendarBlank className="size-4" />
              <span className="text-xs font-medium">Amanhã</span>
              <span className="text-[10px] text-muted-foreground">as 9h</span>
            </button>
          </div>

          {/* Custom date */}
          <div className="space-y-2">
            <Label htmlFor="reminder-custom">Ou escolha uma data</Label>
            <Input
              id="reminder-custom"
              type="date"
              defaultValue={getTomorrowISO()}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => handleCustomChange(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1"
              disabled={pending || !selected}
              type="submit"
              size="sm"
            >
              {pending ? "Agendando..." : "Criar lembrete"}
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
