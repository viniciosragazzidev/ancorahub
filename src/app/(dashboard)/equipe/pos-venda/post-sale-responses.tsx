"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPostSaleSurveyMessagesAction } from "@/features/post-sale-audit/actions";
import { answerChips, matchesSearch, paginate, type AnswerChip } from "@/features/post-sale-audit/responses-view";
import { cn } from "@/lib/utils";

export type PostSaleResponseRow = {
  id: string;
  leadId: string;
  leadName: string;
  brokerName: string | null;
  campaignName: string;
  status: string;
  outcome: string | null;
  rating: number | null;
  answers: Record<string, unknown>;
  sentAt: string | null;
  lastReplyAt: string | null;
};

type Message = { id: string; direction: "in" | "out"; body: string; sentAt: string; fromAssistant: boolean };

const chipTone: Record<AnswerChip["tone"], string> = {
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  bad: "bg-red-500/10 text-red-700 dark:text-red-300",
  neutral: "bg-[var(--surface-secondary)] text-muted-foreground",
};

const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

/** "Quem respondeu" (09/11): the clients who answered, searchable, 10 per page, with the conversation. */
export function PostSaleResponses({ responses }: { responses: PostSaleResponseRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[] | "loading" | string>>({});

  const filtered = useMemo(() => responses.filter((row) => matchesSearch([row.leadName, row.brokerName, typeof row.answers.comment === "string" ? row.answers.comment : null], query)), [responses, query]);
  const view = paginate(filtered, page);

  async function toggle(row: PostSaleResponseRow) {
    if (open === row.id) return setOpen(null);
    setOpen(row.id);
    if (messages[row.id] && messages[row.id] !== "loading" && typeof messages[row.id] !== "string") return;
    setMessages((current) => ({ ...current, [row.id]: "loading" }));
    const result = await getPostSaleSurveyMessagesAction(row.id);
    setMessages((current) => ({ ...current, [row.id]: result.ok ? result.data : result.error }));
  }

  return (
    <Card id="respostas">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Quem respondeu</CardTitle>
          <CardDescription>{responses.length} {responses.length === 1 ? "cliente respondeu" : "clientes responderam"}. Abra para ver as mensagens ou ir para a conversa.</CardDescription>
        </div>
        <Input
          aria-label="Buscar por cliente, corretor ou comentário"
          className="h-10 w-full sm:w-64"
          onChange={(event) => { setQuery(event.target.value); setPage(1); }}
          placeholder="Buscar cliente ou corretor"
          value={query}
        />
      </CardHeader>
      <CardContent className="grid gap-2">
        {view.items.length ? view.items.map((row) => {
          const chips = answerChips(row);
          const loaded = messages[row.id];
          return (
            <div key={row.id} className="rounded-xl border border-border">
              <button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 px-3 py-2 text-left" aria-expanded={open === row.id} onClick={() => void toggle(row)}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.leadName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.brokerName ?? "Sem corretor"} · respondeu {dateTime(row.lastReplyAt)}</span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {chips.map((chip) => <span key={chip.label} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", chipTone[chip.tone])}>{chip.label}</span>)}
                </span>
              </button>
              {open === row.id ? (
                <div className="grid gap-3 border-t border-border px-3 py-3">
                  {typeof row.answers.comment === "string" || typeof row.answers.reason === "string" ? (
                    <p className="text-sm text-muted-foreground">
                      {typeof row.answers.reason === "string" ? <>Motivo: {row.answers.reason}. </> : null}
                      {typeof row.answers.comment === "string" ? <>Comentário: “{row.answers.comment}”</> : null}
                    </p>
                  ) : null}
                  <div className="grid max-h-80 gap-2 overflow-y-auto rounded-xl bg-[var(--surface-secondary)] p-3" aria-label={`Mensagens com ${row.leadName}`}>
                    {loaded === "loading" || loaded === undefined ? <p className="text-sm text-muted-foreground">Carregando mensagens…</p>
                      : typeof loaded === "string" ? <p className="text-sm text-destructive">{loaded}</p>
                      : loaded.length ? loaded.map((message) => (
                        <div key={message.id} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-sm", message.direction === "in" ? "justify-self-start bg-card" : "justify-self-end bg-primary/10")}>
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{message.direction === "in" ? "Cliente" : message.fromAssistant ? "Pesquisa" : "Equipe"} · {dateTime(message.sentAt)}</p>
                        </div>
                      ))
                      : <p className="text-sm text-muted-foreground">Nenhuma mensagem registrada desde o envio.</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button render={<Link href={`/conversas?leadId=${row.leadId}`} />} size="sm">Abrir conversa</Button>
                    <Button render={<Link href={`/leads/${row.leadId}`} />} size="sm" variant="outline">Ver lead</Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        }) : <p className="rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-muted-foreground">{responses.length ? "Ninguém encontrado com essa busca." : "As respostas aparecerão aqui quando os clientes responderem."}</p>}
        <Pager page={view.page} pages={view.pages} onChange={setPage} label="respostas" />
      </CardContent>
    </Card>
  );
}

export function Pager({ page, pages, onChange, label }: { page: number; pages: number; onChange: (page: number) => void; label: string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={`Páginas de ${label}`} className="flex items-center justify-end gap-2 pt-2 text-sm">
      <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
      <span className="tabular-nums text-muted-foreground">Página {page} de {pages}</span>
      <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onChange(page + 1)}>Próxima</Button>
    </nav>
  );
}
