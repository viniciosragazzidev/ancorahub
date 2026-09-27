"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { LockKey } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import type { NoticeChannel } from "@/features/team-notices/catalog";
import { saveCompanyNumberNoticesAction, saveTeamNoticesAction, type TeamNoticeInput } from "../actions";

export type TeamNoticeRow = {
  key: string;
  label: string;
  description: string;
  metaOnly: boolean;
  alwaysOn: boolean;
  immediate: boolean;
  enabled: boolean;
  channel: NoticeChannel;
  freeMessageId: string | null;
};

const DEFAULT_TEXT = "__default__";

/**
 * Team notices (DEC-125): one switch, one channel and one text per automatic
 * WhatsApp message to the team. Spacing, limits and business hours are applied
 * behind the scenes and are not configured here.
 */
export function TeamNoticesCard({
  notices,
  freeMessages,
  channelConnected,
  companyNumberOn: initialCompanyNumberOn,
}: {
  notices: TeamNoticeRow[];
  freeMessages: Array<{ id: string; name: string }>;
  channelConnected: boolean;
  /** Master switch: off = every notice through the official Meta only. */
  companyNumberOn: boolean;
}) {
  const [companyNumberOn, setCompanyNumberOn] = useState(initialCompanyNumberOn);
  const [switchPending, startSwitch] = useTransition();
  const [rows, setRows] = useState(notices);
  const [saved, setSaved] = useState(notices);
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const messageName = useMemo(() => new Map(freeMessages.map((message) => [message.id, message.name])), [freeMessages]);
  const activeCount = rows.filter((row) => row.enabled).length;

  const update = (key: string, patch: Partial<TeamNoticeRow>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function toggleCompanyNumber(enabled: boolean) {
    setCompanyNumberOn(enabled);
    startSwitch(async () => {
      const result = await saveCompanyNumberNoticesAction(enabled);
      if (!result.success) {
        setCompanyNumberOn(!enabled);
        toast.error(result.error);
        return;
      }
      toast.success(enabled ? "Avisos voltam a usar o WhatsApp da empresa." : "Todos os avisos saem agora pela Meta oficial.");
    });
  }

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
        description="Mensagens automáticas do WhatsApp para os corretores e a equipe. Desligado não envia por nenhum canal. Se o número da empresa cair, o aviso sai pelo template aprovado da Meta."
        actions={
          <Button size="sm" disabled={!dirty || isPending} onClick={save}>
            {isPending ? "Salvando…" : "Salvar avisos"}
          </Button>
        }
      />
      <div className="flex items-start gap-3 border-b border-border/60 px-4 py-3">
        <Switch
          checked={companyNumberOn}
          disabled={switchPending}
          onCheckedChange={(checked) => toggleCompanyNumber(checked === true)}
          aria-label={companyNumberOn ? "Parar de usar o WhatsApp da empresa nos avisos" : "Usar o WhatsApp da empresa nos avisos"}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Usar o WhatsApp da empresa nos avisos</p>
          <p className="text-xs leading-5 text-muted-foreground">
            {companyNumberOn
              ? "Ligado: cada aviso segue o canal escolhido abaixo, com a Meta oficial como reserva."
              : "Desligado: todos os avisos saem só pela Meta oficial, com os modelos aprovados. O WhatsApp da empresa não é usado nem como reserva."}
          </p>
        </div>
      </div>
      {companyNumberOn && !channelConnected ? (
        <p className="mx-4 mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
          O número da empresa não está conectado: enquanto isso, os avisos ligados saem pelos templates da Meta.
        </p>
      ) : null}
      <ul className="divide-y divide-border/60">
        {rows.map((row) => (
          <li key={row.key} className="grid gap-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,15rem)_minmax(0,13rem)] xl:items-center">
            <div className="flex min-w-0 items-start gap-3 sm:col-span-2 xl:col-span-1">
              {row.metaOnly ? (
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center text-muted-foreground" aria-label="Sempre ligado pela Meta"><LockKey className="size-4" /></span>
              ) : (
                <Switch checked={row.enabled} disabled={row.alwaysOn} onCheckedChange={(checked) => update(row.key, { enabled: checked === true })} aria-label={row.alwaysOn ? `${row.label}: sempre ligado` : `${row.enabled ? "Desligar" : "Ligar"} ${row.label}`} className="mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {row.label}
                  {row.immediate ? <span className="text-[11px] font-normal text-muted-foreground">sai na hora</span> : null}
                  {row.alwaysOn ? <span className="text-[11px] font-normal text-muted-foreground">sempre ligado</span> : null}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">{row.description}</p>
              </div>
            </div>
            {row.metaOnly ? (
              <p className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-2">Sempre pela API oficial da Meta.</p>
            ) : (
              <>
                <Select value={companyNumberOn ? row.channel : "meta"} disabled={!row.enabled || !companyNumberOn} onValueChange={(value) => update(row.key, { channel: value as NoticeChannel })}>
                  <SelectTrigger aria-label={`Canal de ${row.label}`}>
                    <SelectValue>{companyNumberOn && row.channel === "company_number" ? "WhatsApp da empresa" : "Meta oficial"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_number">WhatsApp da empresa · reserva Meta</SelectItem>
                    <SelectItem value="meta">Meta oficial · reserva WhatsApp da empresa</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={row.freeMessageId ?? DEFAULT_TEXT} disabled={!row.enabled || !companyNumberOn} onValueChange={(value) => update(row.key, { freeMessageId: value === DEFAULT_TEXT ? null : String(value) })}>
                  <SelectTrigger aria-label={`Texto de ${row.label} pelo WhatsApp da empresa`}>
                    <SelectValue>{row.freeMessageId ? messageName.get(row.freeMessageId) ?? "Mensagem removida" : "Texto padrão"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_TEXT}>Texto padrão</SelectItem>
                    {freeMessages.map((message) => <SelectItem key={message.id} value={message.id}>{message.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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
