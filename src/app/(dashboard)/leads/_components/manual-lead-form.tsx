"use client";

import { useActionState, useEffect } from "react";
import { Check, WarningCircle } from "@/components/huge-icons";
import { toast } from "sonner";

import { createManualLeadAction, type LeadCreateState } from "../actions";
import { Button } from "@/components/ui/button";
import { CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LeadCreateState = {};

type PlanOption = { id: string; name: string; carrierName: string };

function groupPlansByCarrier(plans: PlanOption[]) {
  const groups = new Map<string, PlanOption[]>();
  for (const plan of plans) {
    const carrier = plan.carrierName;
    if (!groups.has(carrier)) groups.set(carrier, []);
    groups.get(carrier)!.push(plan);
  }
  return groups;
}

export function ManualLeadForm({ plans }: { plans: PlanOption[] }) {
  const [state, action, pending] = useActionState(createManualLeadAction, initialState);
  useEffect(() => { if (state.error) toast.error(state.error); }, [state.error]);

  const groups = groupPlansByCarrier(plans);

  return <form action={action} onSubmit={() => toast.info("Salvando lead e distribuindo a oportunidade...")} className="space-y-4"><div className="space-y-2"><Label htmlFor="lead-name">Nome completo</Label><Input id="lead-name" name="nome" placeholder="Ex.: Mariana Costa" required /></div><div className="space-y-2"><Label htmlFor="lead-phone">Celular</Label><Input id="lead-phone" inputMode="tel" name="telefone" placeholder="(11) 99999-9999" required /></div><div className="space-y-2"><Label htmlFor="lead-email">E-mail <span className="text-muted-foreground">(opcional)</span></Label><Input id="lead-email" name="email" type="email" /></div><div className="space-y-2"><Label htmlFor="lead-plan">Plano de interesse <span className="text-muted-foreground">(opcional)</span></Label><select className="flex h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm" id="lead-plan" name="planoInteresseId"><option value="">Ainda não definido</option>{Array.from(groups.entries()).map(([carrier, carrierPlans]) => (<optgroup key={carrier} label={carrier}>{carrierPlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</optgroup>))}</select></div><div className="space-y-2"><Label htmlFor="lead-type">Tipo do Lead</Label><select className="flex h-8 w-full rounded-lg border border-input bg-input/30 px-2.5 text-sm" id="lead-type" name="tipo" required><option value="PF">PF (Pessoa Física)</option><option value="PME">PME (Pessoa Jurídica / PME)</option></select></div><label className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm"><input className="mt-0.5 size-4 warning-primary" name="consentimentoLgpd" type="checkbox" value="true" required /><span><span className="block font-medium">Consentimento LGPD</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">O cliente autorizou o tratamento dos dados para fins de contratação de plano de saúde.</span></span></label>{state.duplicate ? <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm"><div className="flex gap-2 text-amber-100"><WarningCircle className="mt-0.5 shrink-0" /><span>Já existe um lead chamado <strong>{state.duplicate.nome}</strong> com este telefone.</span></div><p className="mt-2 text-xs text-amber-100/70">Confirme abaixo para criar um novo registro.</p><label className="mt-3 flex items-center gap-2 text-xs"><input name="duplicateConfirmed" type="checkbox" value="true" required /><span>Confirmo que é um novo contato</span></label></div> : null}{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}<Button className="w-full" disabled={pending} type="submit">{pending ? "Salvando..." : <><Check /> Criar lead</>}</Button><CardDescription>Tenant, filial, origem e atribuição são definidos com segurança no servidor.</CardDescription></form>;
}
