"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import type { TenantChannelRoutableEvent, TenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing-rules";
import { saveTenantChannelRoutingAction } from "../actions";

/** Select value for "keep Meta". */
const META = "__meta__";

export type RoutableEventItem = { key: TenantChannelRoutableEvent; label: string; description: string };
export type FreeMessageItem = { id: string; name: string; category: string; content: string; variables: string[] };

export function TenantChannelRoutingCard({
  events,
  freeMessages,
  initialRouting,
  channelConnected,
}: {
  events: RoutableEventItem[];
  freeMessages: FreeMessageItem[];
  initialRouting: TenantChannelRouting;
  channelConnected: boolean;
}) {
  const [routing, setRouting] = useState<TenantChannelRouting>(initialRouting);
  const [saved, setSaved] = useState<TenantChannelRouting>(initialRouting);
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(routing) !== JSON.stringify(saved);
  const messageName = useMemo(() => new Map(freeMessages.map((message) => [message.id, message.name])), [freeMessages]);
  const usage = useMemo(() => {
    const byMessage = new Map<string, string[]>();
    for (const event of events) {
      const messageId = routing.events[event.key];
      if (messageId) byMessage.set(messageId, [...(byMessage.get(messageId) ?? []), event.label]);
    }
    return byMessage;
  }, [events, routing]);
  const routedCount = Object.keys(routing.events).length;

  const setEvent = (key: TenantChannelRoutableEvent, value: string) => {
    const next = { ...routing.events };
    if (value === META) delete next[key];
    else next[key] = value;
    setRouting({ events: next });
  };

  function save() {
    startTransition(async () => {
      const result = await saveTenantChannelRoutingAction(routing);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(routing);
      toast.success("Envios do número da empresa salvos.");
    });
  }

  return (
    <>
      <Card variant="overview" className="shadow-sm">
        <CardHeader className="gap-2 border-b border-border/70 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>Avisos aos corretores por este número</CardTitle>
              <CardDescription className="mt-1 max-w-2xl leading-5">
                Mensagens digitadas no chat e mensagens livres enviadas aos corretores saem sempre por
                este número enquanto ele estiver conectado. Aqui você escolhe, além disso, quais avisos
                automáticos também saem por ele. Se o número estiver fora do ar, tudo segue pela Meta.
              </CardDescription>
            </div>
            <Badge variant={routedCount ? "info" : "secondary"}>
              {routedCount ? `${routedCount} pelo número da empresa` : "Tudo pela Meta"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-5 py-4">
          {!channelConnected && routedCount > 0 ? (
            <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
              O número da empresa não está conectado: enquanto isso, estes avisos continuam saindo pela Meta.
            </p>
          ) : null}
          {freeMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma mensagem livre ativa. Crie em{" "}
              <Link href="/qualificacao?tab=meta_templates" className="font-medium text-primary underline-offset-4 hover:underline">
                Qualificação → Mensagens & Situações
              </Link>
              .
            </p>
          ) : null}
          <div className="divide-y divide-border/70 rounded-lg border border-border/70">
            {events.map((event) => (
              <div key={event.key} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{event.label}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{event.description}</p>
                </div>
                <Select value={routing.events[event.key] ?? META} onValueChange={(value) => setEvent(event.key, String(value))}>
                  <SelectTrigger aria-label={`Canal para ${event.label}`}>
                    <SelectValue>
                      {routing.events[event.key]
                        ? `Número da empresa · ${messageName.get(routing.events[event.key]!) ?? "mensagem removida"}`
                        : "API oficial Meta"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={META}>API oficial Meta</SelectItem>
                    {freeMessages.map((message) => (
                      <SelectItem key={message.id} value={message.id}>Número da empresa · {message.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Fora desta lista, de propósito: oferta de lead (o aceite usa o botão do template Meta),
              confirmação de presença e convite de primeiro acesso (links com token).
            </p>
            <Button size="sm" variant="outline" disabled={!dirty || isPending} onClick={save}>
              {isPending ? "Salvando…" : "Salvar envios"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="overview" className="shadow-sm">
        <CardHeader className="gap-2 border-b border-border/70 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle>Mensagens livres</CardTitle>
              <CardDescription className="mt-1 max-w-2xl leading-5">
                As mensagens de Qualificação → Mensagens & Situações que podem sair por este número.
                As variáveis são preenchidas com os dados do aviso (ex.: {"{{nome}}"} vira o nome do corretor).
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" render={<Link href="/qualificacao?tab=meta_templates" />}>
              Editar mensagens
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          {freeMessages.map((message) => (
            <div key={message.id} className="grid content-start gap-2 rounded-lg border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{message.name}</p>
                <Badge variant="secondary">{message.category}</Badge>
              </div>
              <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{message.content}</p>
              <div className="flex flex-wrap gap-1.5">
                {message.variables.map((variable) => (
                  <span key={variable} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {usage.get(message.id)?.length ? `Usada em: ${usage.get(message.id)!.join(", ")}` : "Não usada em nenhum aviso"}
              </p>
            </div>
          ))}
          {freeMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma mensagem livre ativa.</p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
