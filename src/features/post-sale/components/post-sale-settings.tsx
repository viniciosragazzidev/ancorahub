"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updatePostSaleSettingsAction } from "@/features/post-sale/actions";

export function PostSaleSettings({ chargebackWindowDays, active }: { chargebackWindowDays: number; active: boolean }) {
  const [days, setDays] = useState(String(chargebackWindowDays));
  const [enabled, setEnabled] = useState(active);
  const [pending, startTransition] = useTransition();
  return <Card className="shadow-none"><CardHeader><CardTitle className="text-base">Pós-venda e chargeback</CardTitle><CardDescription>Controla apenas a sinalização de possíveis estornos. O sistema nunca desconta dinheiro automaticamente.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end"><div className="space-y-1.5"><Label htmlFor="chargeback-days">Janela de chargeback (dias)</Label><Input id="chargeback-days" min="0" max="3650" type="number" value={days} onChange={(event) => setDays(event.target.value)} /></div><label className="flex items-center gap-2 pb-2 text-sm"><input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /> Ativa</label><Button disabled={pending} onClick={() => startTransition(async () => { const result = await updatePostSaleSettingsAction({ chargebackWindowDays: Number(days), active: enabled }); if (result.error) toast.error(result.error); else toast.success("Configuração de pós-venda salva."); })}>{pending ? "Salvando..." : "Salvar configuração"}</Button></CardContent></Card>;
}
