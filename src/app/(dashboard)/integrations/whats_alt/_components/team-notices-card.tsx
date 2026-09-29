"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { LockKey, ChatCircleText, Trash } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchAddList } from "@/components/ui/search-add-list";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetSection, SheetSectionHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import type { NoticeChannel } from "@/features/team-notices/catalog";
import { MAX_NOTICE_FREE_MESSAGES } from "@/features/team-notices/variants";
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
  /** Library messages that rotate on the company number; empty uses the built-in versions. */
  freeMessageIds: string[];
  /** The built-in versions with example values, for the preview. */
  builtInPreviews: string[];
};

type FreeMessage = { id: string; name: string; content: string };

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
  freeMessages: FreeMessage[];
  channelConnected: boolean;
}) {
  const [rows, setRows] = useState(notices);
  const [saved, setSaved] = useState(notices);
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const [textsKey, setTextsKey] = useState<string | null>(null);
  const textsRow = rows.find((row) => row.key === textsKey) ?? null;
  const activeCount = rows.filter((row) => row.enabled && !row.chat).length;
  const usesCompanyNumber = rows.some((row) => row.enabled && !row.metaOnly && row.channel === "company_number");

  const update = (key: string, patch: Partial<TeamNoticeRow>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function save() {
    const payload: TeamNoticeInput[] = rows.filter((row) => !row.metaOnly).map((row) => ({ key: row.key, enabled: row.enabled, channel: row.channel, freeMessageIds: row.freeMessageIds }));
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
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  disabled={!row.enabled || row.channel !== "company_number"}
                  aria-label={`Textos de ${row.label} pelo WhatsApp da empresa`}
                  onClick={() => setTextsKey(row.key)}
                >
                  <span className="truncate">{textsSummary(row)}</span>
                </Button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <p className="border-t border-border/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
        Novo lead e informações do lead saem na hora. Os demais avisos saem de segunda a sexta, das 8h às 18h, com intervalo entre mensagens, e cada pessoa recebe no máximo 2 lembretes por dia. Pelo WhatsApp da empresa, cada envio sorteia uma versão do texto; os textos podem vir de{" "}
        <Link href="/qualificacao?tab=meta_templates" className="font-medium text-foreground underline-offset-4 hover:underline">Qualificação → Mensagens</Link>.
      </p>
      <NoticeTextsSheet
        row={textsRow}
        freeMessages={freeMessages}
        onChange={(freeMessageIds) => {
          if (textsRow) update(textsRow.key, { freeMessageIds });
        }}
        onOpenChange={(open) => {
          if (!open) setTextsKey(null);
        }}
      />
    </Card>
  );
}

function textsSummary(row: TeamNoticeRow) {
  const count = row.freeMessageIds.length;
  if (!count) return `Texto padrão · ${row.builtInPreviews.length} versões`;
  return count === 1 ? "1 texto próprio" : `${count} textos em rotação`;
}

/**
 * The texts of one notice on the company number. Each send picks one at
 * random and never repeats the version the same person got last. Without
 * chosen messages the built-in versions rotate. Changes stay in the card and
 * are saved with "Salvar avisos".
 */
function NoticeTextsSheet({
  row,
  freeMessages,
  onChange,
  onOpenChange,
}: {
  row: TeamNoticeRow | null;
  freeMessages: FreeMessage[];
  onChange: (freeMessageIds: string[]) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const byId = useMemo(() => new Map(freeMessages.map((message) => [message.id, message])), [freeMessages]);
  const chosen = row?.freeMessageIds ?? [];
  const full = chosen.length >= MAX_NOTICE_FREE_MESSAGES;
  const available = freeMessages
    .filter((message) => !chosen.includes(message.id))
    .map((message) => ({ id: message.id, label: message.name, hint: message.content.replace(/\s+/g, " ").slice(0, 90), keywords: message.content }));

  return (
    <Sheet open={Boolean(row)} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-[min(100vw-1rem,36rem)]">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle>Textos · {row.label}</SheetTitle>
              <SheetDescription>Cada envio pelo WhatsApp da empresa sorteia um texto. A mesma pessoa nunca recebe o mesmo texto duas vezes seguidas.</SheetDescription>
            </SheetHeader>
            <SheetBody contentClassName="grid grid-cols-[minmax(0,1fr)] gap-4">
              <SheetSection>
                <SheetSectionHeader>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Textos próprios</p>
                    <p className="text-xs leading-5 text-muted-foreground">Mensagens da biblioteca, até {MAX_NOTICE_FREE_MESSAGES}. Sem nenhuma, valem as versões padrão.</p>
                  </div>
                  <Badge variant="secondary">{chosen.length}/{MAX_NOTICE_FREE_MESSAGES}</Badge>
                </SheetSectionHeader>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-4">
                  {chosen.length ? (
                    <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
                      {chosen.map((id) => {
                        const message = byId.get(id);
                        return (
                          <li key={id} className="flex items-start justify-between gap-2 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground">{message?.name ?? "Mensagem removida ou inativa"}</p>
                              {message ? (
                                <p className="line-clamp-2 whitespace-pre-line text-[11px] leading-4 text-muted-foreground">{message.content}</p>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">Não será enviada.</p>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              className="shrink-0"
                              aria-label={`Remover ${message?.name ?? "mensagem"}`}
                              title="Remover"
                              onClick={() => onChange(chosen.filter((item) => item !== id))}
                            >
                              <Trash className="size-4" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  {chosen.length > 0 && chosen.length < 3 ? (
                    <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      Com menos de 3 textos a rotação fica fraca. Adicione mais, ou remova todos para usar as {row.builtInPreviews.length} versões padrão.
                    </p>
                  ) : null}
                  <SearchAddList
                    items={available}
                    placeholder={full ? `Limite de ${MAX_NOTICE_FREE_MESSAGES} textos` : "Buscar mensagem ativa da biblioteca"}
                    emptyLabel="Nenhuma mensagem ativa com esse nome."
                    disabled={full}
                    onAdd={(item) => onChange([...chosen, item.id])}
                  />
                </div>
              </SheetSection>
              <SheetSection>
                <SheetSectionHeader>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Versões padrão</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {chosen.length ? "Não usadas enquanto houver textos próprios." : "Em rotação agora. Exemplo com valores fictícios."}
                    </p>
                  </div>
                </SheetSectionHeader>
                <ol className="divide-y divide-border/60">
                  {row.builtInPreviews.map((text, index) => (
                    <li key={index} className="px-4 py-3">
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">Versão {index + 1}</p>
                      <p className="whitespace-pre-line break-words text-xs leading-5 text-foreground">{text}</p>
                    </li>
                  ))}
                </ol>
              </SheetSection>
            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Concluir
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
