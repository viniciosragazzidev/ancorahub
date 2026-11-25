"use client";

/**
 * Horário de corte dos leads do plantão (25/11): a janela começa nesse horário do dia útil anterior (padrão 19:00).
 * Fica junto de "Considerar leads a partir de". Salva no servidor e só então confirma; erro mostra a causa e mantém
 * o horário anterior.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDutyLeadsCutAction } from "@/features/lead-distribution/duty-actions";
import { DUTY_LEADS_FROM_PREVIOUS_DAY_AT, formatDutyLeadsCut as formatDutyCut } from "@/features/lead-distribution/duty-presence-domain";

export function DutyLeadsCutControl({ scheduleId, cutAt }: { scheduleId: string; cutAt: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cutAt);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function save(next: string) {
    setNote(null);
    startTransition(async () => {
      const result = await saveDutyLeadsCutAction(scheduleId, next);
      if (!result.ok) {
        setNote({ text: `${result.reason} O corte continua às ${formatDutyCut(cutAt)}.`, error: true });
        return;
      }
      setEditing(false);
      setNote({ text: `Corte salvo: leads a partir das ${formatDutyCut(result.cutAt)} do dia útil anterior.`, error: false });
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <span className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => { setValue(cutAt); setEditing(true); setNote(null); }} title="Horário do dia útil anterior em que começa a janela de leads deste plantão">
          Corte às {formatDutyCut(cutAt)}
        </Button>
        {note ? <span role={note.error ? "alert" : "status"} className="text-xs text-muted-foreground">{note.text}</span> : null}
      </span>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center justify-end gap-2"
      aria-label="Horário de corte dos leads"
      onSubmit={(event) => { event.preventDefault(); save(value); }}
    >
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Leads a partir das
        <Input type="time" required value={value} onChange={(event) => setValue(event.target.value)} className="h-9 w-28 text-base sm:text-sm" aria-label="Horário de corte" />
        do dia útil anterior
      </label>
      <Button type="submit" size="sm" disabled={pending || !value}>{pending ? "Salvando…" : "Salvar"}</Button>
      {cutAt !== DUTY_LEADS_FROM_PREVIOUS_DAY_AT ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => save(DUTY_LEADS_FROM_PREVIOUS_DAY_AT)}>Voltar para {formatDutyCut(DUTY_LEADS_FROM_PREVIOUS_DAY_AT)}</Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setEditing(false); setNote(null); }}>Cancelar</Button>
      {note ? <span role="alert" className="basis-full text-right text-xs text-muted-foreground">{note.text}</span> : null}
    </form>
  );
}
