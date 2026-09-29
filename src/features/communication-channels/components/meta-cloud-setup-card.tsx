"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { ArrowsClockwise, Pause, Trash } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";

import { completeMetaCloudChannelRegistrationAction, disconnectMetaCloudChannelAction, setMetaCloudChannelStatusAction } from "../actions";

type Channel = {
  id: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: string;
  qualityRating: string | null;
  messagingLimit: string | null;
  registrationStatus?: string;
  registrationErrorCode?: string | null;
  registeredAt?: Date | null;
  businessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  lastWebhookAt: Date | null;
  activatedAt: Date | null;
  hasCredentials?: boolean;
};

function formatDate(value: Date | null) {
  if (!value) return "Ainda não sincronizado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function accountStatus(account: Channel | null, enabled: boolean, configured: boolean) {
  if (!enabled) return { label: "Desativada pelo Super-admin", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
  if (!configured) return { label: "Configuração incompleta", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
  if (!account) return { label: "Não conectada", tone: "border-border bg-muted/30 text-muted-foreground" };
  if (account.hasCredentials === false) return { label: "Reconexão necessária", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
  if (account.registrationStatus === "registering") return { label: "Ativando na Meta", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
  if (account.registrationStatus === "failed") return { label: "Ativação pendente", tone: "border-destructive/30 bg-destructive/10 text-destructive" };
  if (account.registrationStatus && account.registrationStatus !== "registered") return { label: "Confirmação pendente", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
  if (account.status === "active") return { label: "Ativa", tone: "border-success/30 bg-success/10 text-success-foreground" };
  return { label: "Pausada", tone: "border-warning/30 bg-warning/10 text-warning-foreground" };
}

export function MetaCloudSetupCard({ enabled, configured, missing, companyAccount, canManage = false, showTechnicalDetails = false }: { enabled: boolean; configured: boolean; missing: string[]; companyAccount: Channel | null; canManage?: boolean; showTechnicalDetails?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const status = accountStatus(companyAccount, enabled, configured);

  const changeStatus = (active: boolean) => {
    if (!companyAccount) return;
    startTransition(async () => {
      try {
        await setMetaCloudChannelStatusAction(companyAccount.id, active);
        toast.success(active ? "Número oficial reativado." : "Número oficial pausado.", { description: active ? undefined : "Nenhuma nova mensagem será processada pelo CRM." });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível alterar o canal agora.");
      }
    });
  };

  const disconnect = () => {
    if (!companyAccount) return;
    startTransition(async () => {
      try {
        await disconnectMetaCloudChannelAction(companyAccount.id);
        setDisconnectOpen(false);
        toast.success("Número desconectado do CRM.", { description: "O histórico foi preservado." });
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível desconectar o número agora.");
      }
    });
  };

  const completeRegistration = () => {
    if (!companyAccount) return;
    startTransition(async () => {
      try {
        await completeMetaCloudChannelRegistrationAction(companyAccount.id);
        toast.success("Número oficial ativado na Cloud API.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ativação do número.");
      }
    });
  };

  return <Card className="border-border bg-card shadow-none">
    <CardHeader><CardTitle>Status do número oficial</CardTitle><CardDescription>Este canal é independente de Marketing, páginas e contas de anúncios.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div aria-live="polite" className={`rounded-lg border p-4 ${status.tone}`}><p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">Status operacional</p><p className="mt-1 text-primary text-lg font-semibold">{status.label}</p></div>
      {!enabled ? <p className="text-sm text-muted-foreground">A capacidade foi desativada globalmente pelo Super-admin.</p> : null}
      {enabled && !configured ? <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium">Configuração técnica indisponível</p><p className="mt-1 text-muted-foreground">O suporte precisa concluir as variáveis seguras do servidor: {missing.join(", ")}.</p></div> : null}
      {enabled && configured && !companyAccount ? <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-sm font-medium">Nenhum número oficial conectado</p><p className="mt-1 text-xs text-muted-foreground">Use o botão abaixo para escolher a conta WhatsApp Business e o número corporativo.</p></div> : null}
      {companyAccount ? <>{companyAccount.hasCredentials === false ? <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium">Reconecte este número</p><p className="mt-1 text-muted-foreground">A autorização da Meta não está mais disponível no CRM. Reconecte o número para restaurar os envios.</p></div> : companyAccount.registrationStatus === "failed" || companyAccount.registrationStatus === "legacy_unverified" ? <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"><p className="font-medium">Este número ainda precisa de ativação técnica</p><p className="mt-1 text-muted-foreground">A confirmação do telefone acontece na Meta. O CRM só libera envios depois que concluir o registro seguro na Cloud API.</p></div> : null}<div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Nome verificado" value={companyAccount.verifiedName ?? "Não informado"} /><Detail label="Número oficial" value={companyAccount.displayPhoneNumber ?? "Não informado"} /><Detail label="Qualidade" value={companyAccount.qualityRating ?? "Ainda não disponível"} /><Detail label="Limite de mensagens" value={companyAccount.messagingLimit ?? "Não informado"} /><Detail label="Último webhook" value={formatDate(companyAccount.lastWebhookAt)} /><Detail label="Registro Cloud API" value={!companyAccount.registrationStatus || companyAccount.registrationStatus === "registered" ? formatDate(companyAccount.registeredAt ?? null) : "Aguardando confirmação"} />{showTechnicalDetails ? <><Detail label="Business ID" value={companyAccount.businessId ?? "—"} mono /><Detail label="WABA ID" value={companyAccount.wabaId ?? "—"} mono /><Detail label="Phone Number ID" value={companyAccount.phoneNumberId ?? "—"} mono /></> : null}</div>{companyAccount.hasCredentials === false ? null : canManage && (companyAccount.registrationStatus === "failed" || companyAccount.registrationStatus === "legacy_unverified") ? <div className="flex flex-wrap gap-2"><Button disabled={pending} onClick={completeRegistration} size="sm"><ArrowsClockwise />Ativar número na Cloud API</Button><Button disabled={pending} onClick={() => setDisconnectOpen(true)} size="sm" variant="destructive"><Trash />Desconectar número</Button></div> : canManage && (!companyAccount.registrationStatus || companyAccount.registrationStatus === "registered") ? <div className="flex flex-wrap gap-2"><Button disabled={pending} onClick={() => changeStatus(companyAccount.status !== "active")} size="sm" variant="outline">{companyAccount.status === "active" ? <><Pause />Pausar</> : "Reativar"}</Button><Button disabled={pending} onClick={() => setDisconnectOpen(true)} size="sm" variant="destructive"><Trash />Desconectar número</Button></div> : canManage ? <Button disabled={pending} onClick={() => setDisconnectOpen(true)} size="sm" variant="destructive"><Trash />Desconectar número</Button> : null}</> : null}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}><DialogPopup className="sm:max-w-md"><DialogHeader><DialogTitle>Desconectar este número do CRM?</DialogTitle><DialogDescription>Novos envios e recebimentos oficiais serão interrompidos. O histórico, auditoria e campanhas permanecem preservados; você poderá reconectar depois.</DialogDescription></DialogHeader><DialogFooter><Button disabled={pending} onClick={() => setDisconnectOpen(false)} variant="outline">Cancelar</Button><Button disabled={pending} onClick={disconnect} variant="destructive">{pending ? "Desconectando…" : "Desconectar número"}</Button></DialogFooter></DialogPopup></Dialog>
    </CardContent>
  </Card>;
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 break-all text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p></div>;
}
