"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { changeWahaConnectionAction, createWahaConnectionAction, refreshWahaConnectionAction, updateWahaCapabilitiesAction } from "../waha-connection-actions";

type Connection = { id: string; label: string | null; scope: string; status: string; displayPhoneNumber: string; capabilities: { inbound: boolean; cadence: boolean; ai: boolean } };

export function WahaConnectionsCard({ connections, role, enabled }: { connections: Connection[]; role: "director" | "manager"; enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<Connection | null>(null);
  const scopeCopy = role === "director" ? "toda a empresa" : "a sua unidade";

  async function create(formData: FormData): Promise<void> {
    setPending(true); const result = await createWahaConnectionAction(formData); setPending(false);
    if (!result.success) { toast.error(result.error); return; }
    setQrCode(result.result.qrCode); toast.success("Sessão criada. Escaneie o QR Code.");
  }
  async function refresh(id: string) {
    setPending(true); const result = await refreshWahaConnectionAction(id); setPending(false);
    if (!result.success) return toast.error(result.error);
    setQrCode(result.result.qrCode); toast.success(result.result.status === "active" ? "Número conectado." : "QR atualizado.");
  }
  async function change(id: string, operation: "pause" | "resume" | "disconnect") {
    setPending(true); const result = await changeWahaConnectionAction(id, operation); setPending(false);
    if (!result.success) return toast.error(result.error);
    setQrCode(result.result.qrCode); toast.success(operation === "disconnect" ? "Número desconectado." : operation === "pause" ? "Número pausado." : "Número retomado.");
    router.refresh();
  }
  async function confirmDisconnect() {
    if (!disconnectTarget) return;
    const target = disconnectTarget;
    setDisconnectTarget(null);
    await change(target.id, "disconnect");
  }
  async function saveCapabilities(id: string, formData: FormData): Promise<void> {
    setPending(true); const result = await updateWahaCapabilitiesAction(id, formData); setPending(false);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("Funções do número atualizadas.");
  }

  return <Card className="border-border bg-card shadow-none">
    <CardHeader><CardTitle>WAHA — números controlados</CardTitle><CardDescription>{enabled ? `Conecte números para ${scopeCopy}. Escolha abaixo quais funções cada número pode executar.` : "A conexão WAHA está desativada pela plataforma."}</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      {enabled ? <form action={create} className="flex flex-col gap-2 sm:flex-row"><Input name="label" minLength={2} maxLength={80} required placeholder={role === "director" ? "Ex.: Atendimento geral" : "Ex.: Unidade Centro"} /><Button disabled={pending} type="submit">{pending ? "Iniciando..." : "Conectar número"}</Button></form> : null}
      {qrCode ? <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center"><p className="mb-3 text-sm font-medium">Escaneie o QR Code no WhatsApp do número</p><img alt="QR Code para conectar WhatsApp" className="mx-auto size-56 rounded bg-white p-2 outline outline-1 outline-black/10 dark:outline-white/10" src={`data:image/png;base64,${qrCode}`} /><p className="mt-3 text-xs text-muted-foreground">O código expira rapidamente. Atualize se necessário.</p></div> : null}
      <div className="divide-y rounded-lg border">{connections.length ? connections.map((connection) => <div className="grid gap-4 p-4" key={connection.id}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{connection.label ?? connection.displayPhoneNumber}</p><p className="text-xs text-muted-foreground">{connection.displayPhoneNumber} · {connection.scope === "tenant" ? "Empresa" : "Unidade"} · <span className="font-medium text-foreground">{connection.status}</span></p></div><div className="flex flex-wrap gap-2"><Button disabled={pending} onClick={() => refresh(connection.id)} size="sm" variant="outline">Atualizar QR</Button>{connection.status === "paused" ? <Button disabled={pending} onClick={() => change(connection.id, "resume")} size="sm" variant="outline">Retomar</Button> : <Button disabled={pending || connection.status !== "active"} onClick={() => change(connection.id, "pause")} size="sm" variant="outline">Pausar</Button>}<Button disabled={pending} onClick={() => setDisconnectTarget(connection)} size="sm" variant="destructive">Desconectar</Button></div></div>
        <form action={(formData) => saveCapabilities(connection.id, formData)} className="grid gap-2 rounded-lg bg-muted/30 p-3 text-xs sm:grid-cols-3"><label className="flex items-center gap-2"><input defaultChecked={connection.capabilities.inbound} name="inbound" type="checkbox" value="true" /> Receber mensagens</label><label className="flex items-center gap-2"><input defaultChecked={connection.capabilities.cadence} name="cadence" type="checkbox" value="true" /> Executar cadências</label><label className="flex items-center gap-2"><input defaultChecked={connection.capabilities.ai} name="ai" type="checkbox" value="true" /> IA após inbound</label><p className="sm:col-span-2 text-muted-foreground">IA só atua depois de uma mensagem recebida. Cadências respeitam descadastro e limites.</p><div className="sm:text-right"><Button disabled={pending} size="sm" type="submit" variant="outline">Salvar funções</Button></div></form>
      </div>) : <p className="p-4 text-sm text-muted-foreground">Nenhum número conectado neste escopo.</p>}</div>
      <Dialog open={disconnectTarget !== null} onOpenChange={(value) => { if (!value) setDisconnectTarget(null); }}><DialogPopup className="sm:max-w-md"><DialogHeader><DialogTitle>Desconectar este número?</DialogTitle><DialogDescription>O número {disconnectTarget?.displayPhoneNumber ?? ""} deixará de enviar e receber mensagens pelo CRM. O histórico é preservado e você pode conectá-lo novamente depois.</DialogDescription></DialogHeader><DialogFooter><Button disabled={pending} variant="outline" onClick={() => setDisconnectTarget(null)}>Cancelar</Button><Button disabled={pending} variant="destructive" onClick={() => void confirmDisconnect()}>{pending ? "Desconectando…" : "Desconectar"}</Button></DialogFooter></DialogPopup></Dialog>
    </CardContent>
  </Card>;
}
