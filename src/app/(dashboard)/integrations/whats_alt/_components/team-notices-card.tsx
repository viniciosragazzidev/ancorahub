"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { LockKey, ChatCircleText } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import type { NoticeChannel } from "@/features/team-notices/catalog";
import { saveTeamNoticesAction, type TeamNoticeInput } from "../actions";

export type TeamNoticeRow = {
  key: string;
  label: string;
  description: string;
  metaOnly: boolean;
  alwaysOn: boolean;
  /** Free text typed in the chat: only the channel is chosen. */
  chat: boolean;
  immediate: boolean;
  enabled: boolean;
  channel: NoticeChannel;
  freeMessageId: string | null;
};

const DEFAULT_TEXT = "__default__";

const CHANNEL_LABEL: Record<NoticeChannel, string> = {
  meta: "Só Meta oficial",
  company_number: "WhatsApp da empresa",
};

/**
 * Team notices (DEC-125): one switch, one channel and one text per automatic
 * WhatsApp message to the team, plus the channel of the messages typed in the
 * chat. Each one goes through the official Meta only (default) or through the
 * company WhatsApp with Meta as the fallback. Spacing, limits and business
 * hours are applied behind the scenes and are not configured here.
 */
export function TeamNoticesCard({
  notices,
  freeMessages,
  channelConnected,
}: {
  notices: TeamNoticeRow[];
  freeMessages: Array<{ id: string; name: string }>;
  channelConnected: boolean;
}) {
  const [rows, setRows] = useState(notices);
  const [saved, setSaved] = useState(notices);
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const messageName = useMemo(() => new Map(freeMessages.map((message) => [message.id, message.name])), [freeMessages]);
  const activeCount = rows.filter((row) => row.enabled && !row.chat).length;
  const usesCompanyNumber = rows.some((row) => row.enabled && !row.metaOnly && row.channel === "company_number");

  const update = (key: string, patch: Partial<TeamNoticeRow>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function save() {
    const payload: TeamNoticeInput[] = rows.filter((row) => !row.metaOnly).map((row) => ({ key: row.key, enabled: row.enabled, channel: row.channel, freeMessageId: row.freeMessageId }));
    startTransition(async () => {
      const result = await saveTeamNoticesAction(payload);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(rows);
      toast.success("Avisos da equipe salvos.");
    });
  }

  return (
    <Card variant="overview">
      <SectionCardHeader
        title="Avisos da equipe"
        badge={<Badge variant="secondary">{activeCount} ligados</Badge>}
        description="Escolha, mensagem por mensagem, se sai só pela Meta oficial (padrão) ou pelo WhatsApp da empresa. Desligado não envia por nenhum canal. Se o WhatsApp da empresa cair, a mensagem sai pela Meta oficial."
        actions={
          <Button size="sm" disabled={!dirty || isPending} onClick={save}>
            {isPending ? "Salvando…" : "Salvar avisos"}
          </Button>
        }
      />
      {usesCompanyNumber && !channelConnected ? (
        <p className="mx-4 mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
          O WhatsApp da empresa não está conectado: enquanto isso, o que estiver marcado para ele sai pela Meta oficial.
        </p>
      ) : null}
      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.key} className="grid gap-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,15rem)_minmax(0,13rem)] xl:items-center">
            <div className="flex min-w-0 items-start gap-3 sm:col-span-2 xl:col-span-1">
              {row.metaOnly ? (
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-muted-foreground" aria-label="Sempre ligado pela Meta"><LockKey className="size-4" /></span>
              ) : row.chat ? (
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-muted-foreground" aria-hidden><ChatCircleText className="size-4" /></span>
              ) : (
                <Switch checked={row.enabled} disabled={row.alwaysOn} onCheckedChange={(checked) => update(row.key, { enabled: checked === true })} aria-label={row.alwaysOn ? `${row.label}: sempre ligado` : `${row.enabled ? "Desligar" : "Ligar"} ${row.label}`} className="mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {row.label}
                  {row.immediate && !row.chat ? <span className="text-[11px] font-normal text-muted-foreground">sai na hora</span> : null}
                  {row.alwaysOn && !row.chat ? <span className="text-[11px] font-normal text-muted-foreground">sempre ligado</span> : null}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">{row.description}</p>
              </div>
            </div>
            {row.metaOnly ? (
              <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-2">Sempre pela API oficial da Meta.</p>
            ) : (
              <>
                <Select value={row.channel} disabled={!row.enabled} onValueChange={(value) => update(row.key, { channel: value as NoticeChannel })}>
                  <SelectTrigger aria-label={`Canal de ${row.label}`}>
                    <SelectValue>{CHANNEL_LABEL[row.channel]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Só Meta oficial</SelectItem>
                    <SelectItem value="company_number">WhatsApp da empresa · reserva Meta</SelectItem>
                  </SelectContent>
                </Select>
                {row.chat ? (
                  <p className="text-xs text-muted-foreground">Texto escrito no chat.</p>
                ) : (
                <Select value={row.freeMessageId ?? DEFAULT_TEXT} disabled={!row.enabled || row.channel !== "company_number"} onValueChange={(value) => update(row.key, { freeMessageId: value === DEFAULT_TEXT ? null : String(value) })}>
                  <SelectTrigger aria-label={`Texto de ${row.label} pelo WhatsApp da empresa`}>
                    <SelectValue>{row.freeMessageId ? messageName.get(row.freeMessageId) ?? "Mensagem removida" : "Texto padrão"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_TEXT}>Texto padrão</SelectItem>
                    {freeMessages.map((message) => <SelectItem key={message.id} value={message.id}>{message.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
        Novo lead e informações do lead saem na hora. Os demais avisos saem de segunda a sexta, das 8h às 18h, com intervalo entre mensagens, e cada pessoa recebe no máximo 2 lembretes por dia. O texto do WhatsApp da empresa pode ser uma mensagem de{" "}
        <Link href="/qualificacao?tab=meta_templates" className="font-medium text-foreground underline-offset-4 hover:underline">Qualificação → Mensagens</Link>.
      </p>
    </Card>
  );
}
