"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { retryCoexistenceSyncAction } from "../actions";
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

export function CoexistenceNumbersCard({ channels, appId, configId, canConnect }: { channels: CoexistenceChannel[]; appId: string | null; configId: string | null; canConnect: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

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
              return (
                <li key={channel.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{channel.displayPhoneNumber ?? "Número sem identificação"}{channel.verifiedName ? <span className="text-muted-foreground"> · {channel.verifiedName}</span> : null}</p>
                    <p className="text-xs text-muted-foreground">Conectado em {formatDateTime(channel.activatedAt)} · último evento {formatDateTime(channel.lastWebhookAt)}</p>
                    <p className="text-xs text-muted-foreground">{SYNC_LABEL[channel.syncStatus ?? "pending"] ?? channel.syncStatus}</p>
                    {channel.syncError ? <p className="text-xs text-muted-foreground">{channel.syncError}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={channel.status === "active" ? "default" : "secondary"}>{channel.status === "active" ? "Ativo" : "Inativo"}</Badge>
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
    </Card>
  );
}
