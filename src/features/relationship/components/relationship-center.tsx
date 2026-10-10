"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { broadcastRecipientsAction, previewAudienceAction, sendBroadcastAction } from "../actions";
import type { Audience, AudienceOptions } from "../audience";
import type { BroadcastKind, BroadcastSummary } from "../service";

type HistoryItem = Omit<BroadcastSummary, "createdAt"> & { createdAt: string };
type AudienceKind = Audience["kind"];

const KINDS: { id: BroadcastKind; label: string; hint: string }[] = [
  { id: "notice", label: "Aviso", hint: "Informação para a equipe." },
  { id: "recognition", label: "Reconhecimento", hint: "Parabéns por um resultado ou atitude." },
  { id: "confirmation", label: "Pedido de confirmação", hint: "O corretor toca em \"Ciente\" e você vê quem confirmou." },
];
const KIND_LABEL: Record<BroadcastKind, string> = { notice: "Aviso", recognition: "Reconhecimento", confirmation: "Confirmação" };

const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (next: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "h-9 rounded-full border px-4 text-sm transition-colors",
            value === option.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CheckList({ items, selected, onToggle, empty }: { items: { id: string; label: string; detail?: string | null }[]; selected: Set<string>; onToggle: (id: string) => void; empty: string }) {
  if (!items.length) return <p className="py-3 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
      {items.map((item) => (
        <li key={item.id}>
          <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
            <span className="min-w-0 flex-1 truncate text-foreground">{item.label}</span>
            {item.detail ? <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span> : null}
          </label>
        </li>
      ))}
    </ul>
  );
}

function toggle(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function RelationshipCenter({ options, history }: { options: AudienceOptions; history: HistoryItem[] }) {
  const router = useRouter();
  const [audienceKind, setAudienceKind] = useState<AudienceKind>("people");
  const [people, setPeople] = useState<Set<string>>(new Set());
  const [branches, setBranches] = useState<Set<string>>(new Set());
  const [dutyTypes, setDutyTypes] = useState<Set<string>>(new Set());
  const [supervisorId, setSupervisorId] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<BroadcastKind>("notice");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [previewState, setPreview] = useState<{ key: string; count: number; names: string[]; error?: string } | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  const audienceOptions = useMemo(() => {
    const list: { id: AudienceKind; label: string }[] = [{ id: "people", label: "Pessoas" }];
    if (options.branches.length > 1 || options.role !== "supervisor") list.push({ id: "branches", label: "Unidade" });
    list.push({ id: "duty_today", label: "Plantão de hoje" });
    if (options.role === "supervisor" || options.supervisors.length) list.push({ id: "team", label: "Equipe" });
    if (options.role === "director") list.push({ id: "all", label: "Todos" });
    return list;
  }, [options]);

  const audience: Audience | null = useMemo(() => {
    switch (audienceKind) {
      case "people": return people.size ? { kind: "people", userIds: [...people] } : null;
      case "branches": return branches.size ? { kind: "branches", branchIds: [...branches] } : null;
      case "duty_today": return { kind: "duty_today", typeIds: [...dutyTypes] };
      case "team": return options.role === "supervisor" ? { kind: "team" } : supervisorId ? { kind: "team", supervisorId } : null;
      case "all": return { kind: "all" };
    }
  }, [audienceKind, people, branches, dutyTypes, supervisorId, options.role]);

  // The count always comes from the server (same resolution as the send).
  const audienceKey = JSON.stringify(audience);
  // Both belong to one audience: changing who receives drops the old count and the pending confirmation.
  const preview = audience && previewState?.key === audienceKey ? previewState : null;
  const confirming = confirmingKey === audienceKey;
  const setConfirming = (value: boolean) => setConfirmingKey(value ? audienceKey : null);
  useEffect(() => {
    if (!audience) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewAudienceAction(audience);
      if (cancelled) return;
      setPreview(result.ok ? { key: audienceKey, count: result.data.count, names: result.data.names } : { key: audienceKey, count: 0, names: [], error: result.error });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey]);

  const filteredBrokers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return options.brokers
      .filter((broker) => !term || broker.name.toLocaleLowerCase("pt-BR").includes(term))
      .map((broker) => ({ id: broker.id, label: broker.name, detail: broker.branchName }));
  }, [options.brokers, search]);

  const ready = Boolean(audience && preview && preview.count > 0 && title.trim().length >= 3 && body.trim().length >= 3);

  function send() {
    if (!audience || !preview) return;
    if (!confirming) { setConfirming(true); return; }
    setFeedback(null);
    startTransition(async () => {
      const result = await sendBroadcastAction({ kind, title, body, audience, channel: "app" });
      setConfirming(false);
      if (!result.ok) { setFeedback({ tone: "error", text: result.error }); return; }
      setFeedback({ tone: "success", text: `Enviado para ${result.data.recipients} ${result.data.recipients === 1 ? "corretor" : "corretores"} (${result.data.label}).` });
      setTitle("");
      setBody("");
      setPeople(new Set());
      router.refresh();
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <section aria-labelledby="composer-title" className="space-y-6 rounded-xl border border-border bg-card p-5">
        <div className="space-y-1">
          <h2 id="composer-title" className="text-base font-medium text-foreground">Nova mensagem</h2>
          <p className="text-sm text-muted-foreground">Chega no app do corretor, no celular (push) e na conversa da Âncora.</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Para quem</p>
          <Segmented label="Para quem" value={audienceKind} options={audienceOptions} onChange={setAudienceKind} />
          {audienceKind === "people" ? (
            <div className="space-y-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar corretor" aria-label="Buscar corretor" />
              <CheckList items={filteredBrokers} selected={people} onToggle={(id) => setPeople((current) => toggle(current, id))} empty="Nenhum corretor encontrado." />
            </div>
          ) : null}
          {audienceKind === "branches" ? (
            <CheckList items={options.branches.map((branch) => ({ id: branch.id, label: branch.name }))} selected={branches} onToggle={(id) => setBranches((current) => toggle(current, id))} empty="Nenhuma unidade no seu escopo." />
          ) : null}
          {audienceKind === "duty_today" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Quem tem plantão hoje. Marque tipos para filtrar, ou deixe vazio para todos os plantões.</p>
              <CheckList items={options.dutyTypes.map((type) => ({ id: type.id, label: type.name }))} selected={dutyTypes} onToggle={(id) => setDutyTypes((current) => toggle(current, id))} empty="Nenhum tipo de plantão cadastrado." />
            </div>
          ) : null}
          {audienceKind === "team" && options.role !== "supervisor" ? (
            <select
              value={supervisorId}
              onChange={(event) => setSupervisorId(event.target.value)}
              aria-label="Supervisor da equipe"
              className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">Escolha o supervisor</option>
              {options.supervisors.map((supervisor) => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}
            </select>
          ) : null}
          {audienceKind === "team" && options.role === "supervisor" ? <p className="text-sm text-muted-foreground">Os corretores da sua equipe.</p> : null}
          {audienceKind === "all" ? <p className="text-sm text-muted-foreground">Todos os corretores ativos da empresa.</p> : null}

          <div aria-live="polite" className="text-sm">
            {preview?.error ? <p className="text-destructive">{preview.error}</p> : null}
            {preview && !preview.error ? (
              <p className="text-muted-foreground">
                Vai para <span className="font-medium text-foreground">{preview.count} {preview.count === 1 ? "corretor" : "corretores"}</span>
                {preview.count > 0 ? (
                  <button type="button" className="ml-2 text-primary underline-offset-4 hover:underline" onClick={() => setShowNames((value) => !value)}>
                    {showNames ? "esconder nomes" : "ver nomes"}
                  </button>
                ) : null}
              </p>
            ) : null}
            {showNames && preview?.names.length ? <p className="mt-1 text-xs text-muted-foreground">{preview.names.join(", ")}{preview.count > preview.names.length ? ` e mais ${preview.count - preview.names.length}` : ""}</p> : null}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Tipo</p>
          <Segmented label="Tipo" value={kind} options={KINDS} onChange={setKind} />
          <p className="text-sm text-muted-foreground">{KINDS.find((item) => item.id === kind)?.hint}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="relationship-title" className="text-sm font-medium text-foreground">Título</label>
          <Input id="relationship-title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "recognition" ? "Parabéns pelo plantão de ontem" : "Escala de novembro publicada"} />
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="relationship-body" className="text-sm font-medium text-foreground">Mensagem</label>
            <span className="text-xs text-muted-foreground">{body.length}/1000</span>
          </div>
          <Textarea id="relationship-body" value={body} maxLength={1000} rows={5} onChange={(event) => setBody(event.target.value)} placeholder="Escreva como você falaria com a equipe." />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Canal</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex h-9 items-center rounded-full border border-primary bg-primary px-4 text-primary-foreground">Só no sistema</span>
            <span className="inline-flex h-9 items-center rounded-full border border-border px-4 text-muted-foreground" title="Chega na próxima etapa">Sistema + WhatsApp (em breve)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="button" onClick={send} disabled={!ready || pending}>
            {pending ? "Enviando..." : confirming ? `Confirmar envio para ${preview?.count ?? 0}` : "Enviar"}
          </Button>
          {confirming && !pending ? <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Voltar</Button> : null}
          {feedback ? <p role="status" className={cn("text-sm", feedback.tone === "success" ? "text-success" : "text-destructive")}>{feedback.text}</p> : null}
        </div>
      </section>

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="text-base font-medium text-foreground">Enviadas</h2>
        {!history.length ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma mensagem enviada ainda. A primeira aparece aqui com quem leu.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((item) => {
              const readPct = item.recipientsCount ? Math.round((item.read / item.recipientsCount) * 100) : 0;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => setOpenId(item.id)} className="w-full space-y-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.audienceLabel} · {item.senderName} · {dateTime.format(new Date(item.createdAt))}</p>
                      </div>
                      <Badge variant={item.kind === "recognition" ? "success" : item.kind === "confirmation" ? "warning" : "secondary"}>{KIND_LABEL[item.kind]}</Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${readPct}%` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.read} de {item.recipientsCount} leram
                        {item.requireAck ? ` · ${item.acked} confirmaram` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RecipientsSheet key={openId ?? "closed"} item={history.find((item) => item.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </div>
  );
}

type Recipient = { brokerId: string; name: string; readAt: string | null; ackAt: string | null };

function RecipientsSheet({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  const [rows, setRows] = useState<Recipient[] | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const itemId = item?.id ?? null;

  // Keyed by the item in the parent: a new item starts from fresh state.
  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    broadcastRecipientsAction(itemId).then((result) => {
      if (!cancelled) setRows(result.ok ? result.data : []);
    });
    return () => { cancelled = true; };
  }, [itemId]);

  const pendingOf = (row: Recipient) => (item?.requireAck ? !row.ackAt : !row.readAt);
  const visible = (rows ?? []).filter((row) => !onlyPending || pendingOf(row));

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{item?.title ?? ""}</SheetTitle>
          <SheetDescription>{item ? `${item.audienceLabel} · ${dateTime.format(new Date(item.createdAt))}` : ""}</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-4">
          {item ? <p className="whitespace-pre-line rounded-lg bg-muted/60 p-3 text-sm text-foreground">{item.body}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{item?.requireAck ? "Confirmações" : "Leitura"}</p>
            <Button type="button" size="sm" variant={onlyPending ? "default" : "outline"} onClick={() => setOnlyPending((value) => !value)}>
              {item?.requireAck ? "Só quem não confirmou" : "Só quem não leu"}
            </Button>
          </div>
          {rows === null ? <p className="text-sm text-muted-foreground">Carregando...</p> : null}
          {rows !== null && !visible.length ? <p className="text-sm text-muted-foreground">{onlyPending ? "Todo mundo já viu." : "Ninguém nesse envio."}</p> : null}
          <ul className="divide-y divide-border">
            {visible.map((row) => (
              <li key={row.brokerId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-foreground">{row.name}</span>
                <span className={cn("shrink-0 text-xs", pendingOf(row) ? "text-muted-foreground" : "text-success")}>
                  {row.ackAt ? `Ciente ${dateTime.format(new Date(row.ackAt))}` : row.readAt ? `Leu ${dateTime.format(new Date(row.readAt))}` : "Ainda não leu"}
                </span>
              </li>
            ))}
          </ul>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
