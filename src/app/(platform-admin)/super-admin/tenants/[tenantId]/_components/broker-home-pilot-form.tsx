"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { BrokerHomePilot } from "@/features/broker-workspace/home-pilot";
import { saveBrokerHomePilotFormAction } from "../../../broker-home-pilot-actions";

export function BrokerHomePilotForm({ tenantId, pilot, brokers }: { tenantId: string; pilot: BrokerHomePilot; brokers: { userId: string; label: string }[] }) {
  const [state, action, pending] = useActionState(saveBrokerHomePilotFormAction.bind(null, tenantId), {});
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <Badge variant={pilot.enabled ? "success" : "outline"}>{pilot.enabled ? "Piloto ativo" : "Piloto desativado"}</Badge>
    <fieldset disabled={pending} className="grid gap-4">
      <label className="flex min-h-11 items-center gap-3"><Checkbox name="enabled" value="true" defaultChecked={pilot.enabled} />Ativar para os corretores selecionados</label>
      <fieldset className="grid max-h-64 gap-2 overflow-y-auto"><legend className="mb-2 text-sm font-medium">Corretores participantes</legend>
        {brokers.map((broker) => <label key={broker.userId} className="flex min-h-11 items-center gap-3"><Checkbox name="brokerIds" value={broker.userId} defaultChecked={pilot.brokerIds.includes(broker.userId)} />{broker.label}</label>)}
        {!brokers.length ? <p className="text-sm text-muted-foreground">Nenhum corretor ativo nesta empresa.</p> : null}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3"><Checkbox name="showLearning" value="true" defaultChecked={pilot.showLearning} />Mostrar jornada e primeiros passos no acompanhamento</label>
    </fieldset>
    {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : state.saved ? <p role="status" className="text-sm text-muted-foreground">Piloto salvo. A seleção vale na próxima atualização da Home.</p> : null}
    <Button type="submit" loading={pending} disabled={pending} className="w-fit">{pending ? "Salvando piloto…" : "Salvar piloto do corretor"}</Button>
  </form>;
}
