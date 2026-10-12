"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { releaseDutyPresenceAction } from "@/features/lead-distribution/duty-actions";

/**
 * Roster-row button: releases a broker on this plantão without their presence
 * click. They become eligible for offers right away; the release is audited
 * with who did it. Presencial (2026-10-12): with the broker's photo it validates
 * the photo; without it, the manager must write the reason (kept and audited).
 */
export function BrokerPresenceReleaseButton({ scheduleId, assignmentId, brokerName, inUnit = false, withPhoto = false }: { scheduleId: string; assignmentId: string; brokerName: string; inUnit?: boolean; /** Presencial photo already sent: the manager validates it and releases. */ withPhoto?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const needsNote = inUnit && !withPhoto;

  function release(withNote: string | null) {
    startTransition(async () => {
      const result = await releaseDutyPresenceAction(scheduleId, assignmentId, withNote);
      if (result.ok) {
        toast.success(withPhoto ? `Foto validada. ${brokerName} já pode receber leads.` : inUnit ? `${brokerName} liberado(a) sem foto. O motivo ficou registrado.` : `${brokerName} liberado(a) no plantão.`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.reason);
      }
    });
  }

  const label = withPhoto ? "Validar foto e liberar" : inUnit ? "Liberar sem foto" : "Liberar";

  if (!needsNote) {
    return (
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={pending}
        aria-label={withPhoto ? `Validar a foto e liberar ${brokerName}` : `Liberar ${brokerName} no plantão sem a confirmação dele`}
        title={withPhoto ? "Validar a foto do local e liberar" : "Liberar sem a confirmação do corretor"}
        onClick={() => release(null)}
      >
        <CheckCircle2 className="size-3.5" />
        {label}
      </Button>
    );
  }

  // Presencial without a photo: a short reason is required (e.g. "Vi o corretor na unidade, câmera com defeito").
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="xs" disabled={pending} aria-label={`Liberar ${brokerName} sem a foto do local`} />}>
        <CheckCircle2 className="size-3.5" />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2">
        <p className="text-sm font-medium">Liberar {brokerName.split(/\s+/)[0]} sem a foto</p>
        <p className="text-xs text-muted-foreground">O plantão é presencial e o corretor ainda não enviou a foto do local. Escreva o motivo: ele fica registrado.</p>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={300} rows={3} placeholder="Ex.: vi o corretor na unidade, a câmera dele não abre" aria-label="Motivo para liberar sem foto" autoFocus />
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button type="button" size="sm" disabled={pending || note.trim().length < 5} onClick={() => release(note.trim())}>{pending ? "Liberando…" : "Liberar com motivo"}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
