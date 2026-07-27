"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { disconnectWhatsAppTenantAction, connectWhatsAppTenantAction, validateWhatsAppTenantAction } from "./actions";

type Tenant = { id: string; name: string; status: string };
type Connection = { id: string; tenantId: string; displayPhoneNumber: string | null; verifiedName: string | null; status: string; qualityRating: string | null; lastWebhookAt: Date | null };

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Ainda não recebido";
}

export function WhatsAppAdminPanel({ tenants, connections }: { tenants: Tenant[]; connections: Connection[] }) {
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const connectionByTenant = new Map(connections.map((connection) => [connection.tenantId, connection]));
  const selectedConnection = connectionByTenant.get(tenantId);

  function submit(formData: FormData) {
    startTransition(async () => {
      const validation = await validateWhatsAppTenantAction(formData);
      if (!validation.success) { toast.error(validation.error); return; }
      toast.success("Conexão validada", { description: `${validation.verifiedName} · ${validation.displayPhoneNumber}` });
      const result = await connectWhatsAppTenantAction(formData);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Empresa conectada ao WhatsApp oficial", { description: result.displayPhoneNumber ?? undefined });
      window.location.reload();
    });
  }

  return <div className="space-y-6">
    <Card className="border-border bg-card shadow-none">
      <CardHeader><CardTitle>Contas empresariais</CardTitle><CardDescription>O Super Admin valida e associa um único canal oficial a cada tenant. Nenhum token é exibido depois do salvamento.</CardDescription></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="px-5 py-3 font-medium">Empresa</th><th className="px-3 py-3 font-medium">Canal</th><th className="px-3 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Último webhook</th></tr></thead><tbody>{tenants.map((tenant) => { const connection = connectionByTenant.get(tenant.id); return <tr className="border-b border-border last:border-0" key={tenant.id}><td className="px-5 py-3 font-medium">{tenant.name}</td><td className="px-3 py-3 text-muted-foreground">{connection?.displayPhoneNumber ?? "Não conectado"}</td><td className="px-3 py-3"><span className={connection?.status === "active" ? "text-success" : "text-muted-foreground"}>{connection?.status === "active" ? "Conectado" : connection ? "Pausado" : "Não conectado"}</span></td><td className="px-5 py-3 text-muted-foreground">{formatDate(connection?.lastWebhookAt ?? null)}</td></tr>; })}</tbody></table>
        </div>
      </CardContent>
    </Card>

    <Card className="border-border bg-card shadow-none">
      <CardHeader><CardTitle>Configurar canal oficial</CardTitle><CardDescription>Selecione a empresa, valide os dados diretamente na Meta e só então salve a conexão.</CardDescription></CardHeader>
      <CardContent>
        <form action={submit} className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="tenantId">Empresa</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" id="tenantId" name="tenantId" onChange={(event) => setTenantId(event.target.value)} value={tenantId} required>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {tenant.status}</option>)}</select></div>
          {selectedConnection ? <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm lg:col-span-2"><p className="font-medium">Esta empresa já possui um canal</p><p className="mt-1 text-muted-foreground">Uma nova conexão substituirá somente após validação e não pode usar um número associado a outro tenant.</p></div> : null}
          <div className="space-y-1.5"><Label htmlFor="displayName">Nome do canal</Label><Input id="displayName" name="displayName" placeholder="Canal Oficial" required /></div>
          <div className="space-y-1.5"><Label htmlFor="displayPhoneNumber">Número exibido</Label><Input id="displayPhoneNumber" name="displayPhoneNumber" placeholder="+55 21 99449-6129" required /></div>
          <div className="space-y-1.5"><Label htmlFor="wabaId">WABA ID</Label><Input id="wabaId" inputMode="numeric" name="wabaId" placeholder="Identificador da conta WhatsApp Business" required /></div>
          <div className="space-y-1.5"><Label htmlFor="phoneNumberId">Phone Number ID</Label><Input format="none" id="phoneNumberId" inputMode="numeric" name="phoneNumberId" placeholder="Identificador do número na Meta" required /></div>
          <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="accessToken">Access Token</Label><Input autoComplete="new-password" id="accessToken" name="accessToken" placeholder="Cole o token somente nesta sessão" required type="password" /><p className="text-xs text-muted-foreground">O token é usado para validar a Meta e salvo apenas cifrado. Nunca será retornado ou mostrado novamente.</p></div>
          <div className="flex flex-wrap gap-3 lg:col-span-2"><Button disabled={isPending || !tenantId} type="submit">{isPending ? "Validando e conectando…" : "Validar e conectar empresa"}</Button>{selectedConnection ? <Button disabled={isPending} formAction={disconnectWhatsAppTenantAction} formNoValidate name="channelId" value={selectedConnection.id} type="submit" variant="outline">Desconectar canal</Button> : null}</div>
        </form>
      </CardContent>
    </Card>
  </div>;
}
