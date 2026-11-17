"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updatePendingSupervisedBrokerAction } from "./pending-broker-actions";

export type PendingBrokerRegistration = {
  brokerProfileId: string;
  brokerName: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  brokerCode: string | null;
};

/** Cadastro de um corretor que a equipe adicionou e ainda não aceitou o convite. */
export function PendingBrokerEditSheet({ broker }: { broker: PendingBrokerRegistration }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  function save(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      const result = await updatePendingSupervisedBrokerAction({
        brokerProfileId: broker.brokerProfileId,
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        cpf: formData.get("cpf") ?? "",
        brokerCode: formData.get("brokerCode") ?? "",
      });
      setFailed(!result.ok);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <BottomSheet
      className="arc-venancor"
      trigger={<Button variant="outline" size="sm">Editar</Button>}
      title={`Editar ${broker.brokerName}`}
      description="Os dados valem para o convite. Se mudar o telefone, reenvie o convite para o novo número."
      closeLabel="Fechar"
      detents={[0.7]}
    >
      <form action={save} className="grid gap-2">
        <Input name="name" aria-label="Nome" defaultValue={broker.brokerName} required minLength={2} maxLength={120} />
        <Input name="email" type="email" aria-label="E-mail" defaultValue={broker.email ?? ""} required maxLength={254} />
        <Input name="phone" type="tel" aria-label="Telefone" defaultValue={broker.phone ?? ""} required minLength={10} maxLength={30} />
        <Input name="cpf" inputMode="numeric" aria-label="CPF" placeholder="CPF (11 dígitos)" defaultValue={broker.cpf ?? ""} maxLength={20} />
        <Input name="brokerCode" aria-label="Código do corretor" placeholder="Código do corretor" defaultValue={broker.brokerCode ?? ""} maxLength={40} />
        <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar cadastro"}</Button>
        {message ? <p role="status" className={failed ? "text-sm text-[var(--danger)]" : "text-sm text-[var(--text-muted)]"}>{message}</p> : null}
      </form>
    </BottomSheet>
  );
}
