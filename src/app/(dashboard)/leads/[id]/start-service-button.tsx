"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ChatCircleText } from "@/components/huge-icons";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startLeadServiceAction } from "./service-action";

export function StartServiceButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || completed) return;
    const formData = new FormData(event.currentTarget);
    toast.info("Solicitando início do atendimento...");
    startTransition(async () => {
      let result;
      try {
        result = await startLeadServiceAction({}, formData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível iniciar o atendimento.");
        return;
      }
      if (!result.success || !result.whatsappUrl) {
        toast.error(result.error ?? "Não foi possível iniciar o atendimento.");
        return;
      }
      setCompleted(true);
      toast.success("Atendimento iniciado com sucesso.", { description: "Dados liberados. Abrindo seu WhatsApp pessoal..." });
      window.setTimeout(() => window.location.assign(result.whatsappUrl!), 650);
    });
  }

  return <form onSubmit={handleSubmit}><input name="leadId" type="hidden" value={leadId} /><Button disabled={pending || completed} size="sm" type="submit"> <ChatCircleText /> {pending ? "Iniciando atendimento..." : completed ? "Atendimento iniciado" : "Iniciar atendimento"}</Button></form>;
}
