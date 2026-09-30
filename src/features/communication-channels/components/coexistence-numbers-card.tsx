"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";

import { retryCoexistenceSyncAction, saveChannelLeadIntakeAction } from "../actions";
import type { ChannelLeadIntake } from "../channel-lead-intake";
import { MetaEmbeddedSignupCard } from "./meta-embedded-signup-card";

export type CoexistenceChannel = {
  id: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  status: string;
  activatedAt: Date | null;
  lastWebhookAt: Date | null;
  syncStatus: string | null;
  syncError: string | null;
  leadIntake?: ChannelLeadIntake;
};

/** Meta accepts the one-time sync only within 24h of onboarding. */
const SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;

const SYNC_LABEL: Record<string, string> = {
  pending: "Sincronização não pedida",
  requested: "Contatos e histórico pedidos à Meta",
  done: "Histórico recebido",
  failed: "Sincronização falhou",
};

function formatDateTime(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

/** "Entrada de leads" of one number: new contacts become leads with this origin, in this queue. */
function LeadIntakeSheet({ channel, queues, adAccountNames, onClose }: { channel: CoexistenceChannel; queues: { id: string; name: string }[]; adAccountNames: string[]; onClose: () => void }) {
  const router = useRouter();
  const current = channel.leadIntake;
  const [enabled, setEnabled] = useState(current?.enabled ?? false);
  const [queueId, setQueueId] = useState(current?.queueId ?? "");
  // No default account: the origin is chosen explicitly, never guessed.
  const [label, setLabel] = useState(current?.label ?? "");
  const [aiQualification, setAiQualification] = useState(current?.aiQualification ?? false);
  const [pending, startTransition] = useTransition();
  const labels = Array.from(new Set([...(current?.label ? [current.label] : []), ...adAccountNames.map((name) => `Anúncios ${name}`)]));
  const save = () => startTransition(async () => {
    try {
      await saveChannelLeadIntakeAction({ channelId: channel.id, enabled, queueId: queueId || null, label: label || null, aiQualification });
      toast.success(enabled ? "Contatos novos deste número passam a entrar como lead." : "Entrada de leads desligada para este número.");
      router.refresh();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  });
  return (
    <>
      <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4">
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          Para um número usado nos anúncios de WhatsApp. Quem clica no anúncio já vira lead pela campanha. Com esta opção, também vira lead quem escreve sem o clique (a Meta só identifica o anúncio na primeira mensagem) e quem vem de uma campanha sem regra de fila. Contatos que já conversavam com o número antes da conexão, corretores e clientes não viram lead.
        </p>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span>Contatos novos viram lead</span>
          <Switch checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} aria-label="Contatos novos viram lead" />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
          <span className="grid gap-0.5">
            <span>Qualificação pela IA</span>
            <span className="text-xs leading-4 text-muted-foreground">Desligada: o CRM só recebe os leads e as mensagens deste número e distribui; a IA não conversa com eles (a automação do aplicativo continua).</span>
          </span>
          <Switch checked={aiQualification} onCheckedChange={(checked) => setAiQualification(checked === true)} aria-label="Qualificação pela IA" />
        </label>
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Fila</p>
          <Select value={queueId} onValueChange={(value) => setQueueId((value as string) ?? "")}>
            <SelectTrigger aria-label="Fila"><SelectValue>{queues.find((queue) => queue.id === queueId)?.name ?? "Escolha a fila"}</SelectValue></SelectTrigger>
            <SelectContent>{queues.map((queue) => <SelectItem key={queue.id} value={queue.id}>{queue.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <p className="text-sm font-medium">Origem no lead</p>
          <Select value={label} onValueChange={(value) => setLabel((value as string) ?? "")}>
            <SelectTrigger aria-label="Origem"><SelectValue>{label || "Escolha a conta de anúncios"}</SelectValue></SelectTrigger>
            <SelectContent>{labels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" disabled={pending} onClick={save}>{pending ? "Salvando…" : "Salvar entrada de leads"}</Button>
      </SheetFooter>
    </>
  );
}

export function CoexistenceNumbersCard({ channels, appId, configId, canConnect, queues = [], adAccountNames = [] }: { channels: CoexistenceChannel[]; appId: string | null; configId: string | null; canConnect: boolean; queues?: { id: string; name: string }[]; adAccountNames?: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [intakeFor, setIntakeFor] = useState<CoexistenceChannel | null>(null);

  const retry = (channelId: string) => startTransition(async () => {
    setFeedback(null);
    try {
      const result = await retryCoexistenceSyncAction(channelId);
      setFeedback(result.status === "failed" ? "A Meta recusou a sincronização. Veja o motivo abaixo do número." : "Sincronização pedida à Meta.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível pedir a sincronização.");
    }
  });

  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Números no aplicativo WhatsApp Business</CardTitle>
        <CardDescription className="mt-1">
          Coexistência: o número continua no aplicativo do celular e também recebe e responde pelo CRM. Os avisos e templates continuam saindo do número oficial principal.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {channels.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {channels.map((channel) => {
              const withinWindow = channel.activatedAt ? Date.now() - new Date(channel.activatedAt).getTime() < SYNC_WINDOW_MS : false;
              const canRetry = canConnect && withinWindow && (channel.syncStatus === "failed" || channel.syncStatus === "pending");
              const intake = channel.leadIntake;
              const queueName = intake?.queueId ? queues.find((queue) => queue.id === intake.queueId)?.name : null;
              return (
                <li key={channel.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{channel.displayPhoneNumber ?? "Número sem identificação"}{channel.verifiedName ? <span className="text-muted-foreground"> · {channel.verifiedName}</span> : null}</p>
                    <p className="text-xs text-muted-foreground">Conectado em {formatDateTime(channel.activatedAt)} · último evento {formatDateTime(channel.lastWebhookAt)}</p>
                    <p className="text-xs text-muted-foreground">{SYNC_LABEL[channel.syncStatus ?? "pending"] ?? channel.syncStatus}</p>
                    {channel.syncError ? <p className="text-xs text-muted-foreground">{channel.syncError}</p> : null}
                    <p className="text-xs text-muted-foreground">Entrada de leads: {intake?.enabled ? `ligada → ${queueName ?? "fila removida"}${intake.label ? ` · ${intake.label}` : ""}` : "só quem clica no anúncio"} · IA {intake?.aiQualification ? "conversa com os leads" : "não conversa"}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant={channel.status === "active" ? "default" : "secondary"}>{channel.status === "active" ? "Ativo" : "Inativo"}</Badge>
                    {canConnect ? <Button variant="outline" size="sm" onClick={() => setIntakeFor(channel)}>Entrada de leads</Button> : null}
                    {canRetry ? <Button variant="outline" size="sm" disabled={pending} onClick={() => retry(channel.id)}>Sincronizar de novo</Button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum número do aplicativo conectado.</p>
        )}
        {feedback ? <p role="status" className="text-sm text-muted-foreground">{feedback}</p> : null}
        {canConnect && appId && configId ? <MetaEmbeddedSignupCard appId={appId} configId={configId} mode="coexistence" /> : null}
      </CardContent>
      <Sheet open={Boolean(intakeFor)} onOpenChange={(open) => { if (!open) setIntakeFor(null); }}>
        <SheetContent className="data-[side=right]:w-[min(100vw-1rem,32rem)]">
          {intakeFor ? (
            <>
              <SheetHeader>
                <SheetTitle>Entrada de leads · {intakeFor.displayPhoneNumber}</SheetTitle>
                <SheetDescription>Quem escreve para este número e ainda não é lead nem cliente.</SheetDescription>
              </SheetHeader>
              <LeadIntakeSheet key={intakeFor.id} channel={intakeFor} queues={queues} adAccountNames={adAccountNames} onClose={() => setIntakeFor(null)} />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
