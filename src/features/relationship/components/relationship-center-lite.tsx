"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotionConfig } from "motion/react";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge } from "@/components/arc/badge/badge";
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { Input } from "@/components/arc/input/input";
import RadioCards from "@/components/arc/radio-cards/radio-cards";
import { SearchField } from "@/components/arc/search-field/search-field";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Textarea } from "@/components/arc/textarea/textarea";
import { motionTokens } from "@/components/arc/lib/motion-tokens";

import { broadcastRecipientsAction, previewAudienceAction, sendBroadcastAction } from "../actions";
import type { Audience, AudienceOptions } from "../audience";
import type { BroadcastKind, BroadcastSummary } from "../service";
import styles from "./relationship-center-lite.module.css";

type HistoryItem = Omit<BroadcastSummary, "createdAt"> & { createdAt: string };
type AudienceKind = Audience["kind"];
type Recipient = { brokerId: string; name: string; readAt: string | null; ackAt: string | null };

const KINDS: { value: BroadcastKind; label: string; description: string }[] = [
  { value: "notice", label: "Aviso", description: "Uma informação para quem recebe." },
  { value: "recognition", label: "Reconhecimento", description: "Parabéns por um resultado ou atitude." },
  { value: "confirmation", label: "Pedir confirmação", description: "Cada um toca em Ciente e você vê quem confirmou." },
];
const KIND_LABEL: Record<BroadcastKind, string> = { notice: "Aviso", recognition: "Reconhecimento", confirmation: "Confirmação" };
const KIND_TONE: Record<BroadcastKind, "info" | "success" | "warning"> = { notice: "info", recognition: "success", confirmation: "warning" };
const PLACEHOLDER: Record<BroadcastKind, string> = { notice: "Escala de novembro publicada", recognition: "Parabéns pelo plantão de ontem", confirmation: "Leia a nova regra de repasse" };

const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

function toggle(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg>
);

/**
 * Central de relacionamento in the Lite (supervisor): same rules and actions as
 * the normal screen, rebuilt with the Lite design system. Two tabs: write a
 * message and follow what was sent (who read, who confirmed).
 */
export function RelationshipCenterLite({ options, history, initialBrokerId, initialKind = "notice", initialTitle = "", initialBody = "" }: {
  options: AudienceOptions; history: HistoryItem[]; initialBrokerId?: string | null; initialKind?: BroadcastKind; initialTitle?: string; initialBody?: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotionConfig();
  const [tab, setTab] = useState<"new" | "sent">("new");
  const [audienceKind, setAudienceKind] = useState<AudienceKind>(initialBrokerId ? "people" : options.role === "supervisor" ? "team" : "people");
  const [people, setPeople] = useState<Set<string>>(new Set(initialBrokerId ? [initialBrokerId] : []));
  const [dutyTypes, setDutyTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<BroadcastKind>(initialKind);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [previewState, setPreview] = useState<{ key: string; count: number; names: string[]; error?: string } | null>(null);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  const audienceOptions = useMemo(() => {
    const list: { value: AudienceKind; label: string }[] = [];
    if (options.role === "supervisor") list.push({ value: "team", label: "Minha equipe" });
    list.push({ value: "people", label: "Escolher pessoas" });
    list.push({ value: "duty_today", label: "Plantão de hoje" });
    return list;
  }, [options.role]);

  const audience: Audience | null = useMemo(() => {
    switch (audienceKind) {
      case "people": return people.size ? { kind: "people", userIds: [...people] } : null;
      case "duty_today": return { kind: "duty_today", typeIds: [...dutyTypes] };
      case "team": return { kind: "team" };
      default: return null;
    }
  }, [audienceKind, people, dutyTypes]);

  // The count always comes from the server (same resolution as the send).
  const audienceKey = JSON.stringify(audience);
  const preview = audience && previewState?.key === audienceKey ? previewState : null;
  const confirming = confirmingKey === audienceKey;
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

  const brokers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return options.brokers.filter((broker) => !term || broker.name.toLocaleLowerCase("pt-BR").includes(term));
  }, [options.brokers, search]);
  const selectedBrokers = options.brokers.filter((broker) => people.has(broker.id));

  const ready = Boolean(audience && preview && preview.count > 0 && title.trim().length >= 3 && body.trim().length >= 3);
  const missing = !audience ? "Escolha quem recebe." : preview && preview.count === 0 ? "Ninguém nesse grupo agora." : title.trim().length < 3 ? "Dê um título." : body.trim().length < 3 ? "Escreva a mensagem." : null;

  function send() {
    if (!audience || !preview) return;
    if (!confirming) { setConfirmingKey(audienceKey); return; }
    setFeedback(null);
    startTransition(async () => {
      const result = await sendBroadcastAction({ kind, title, body, audience, channel: "app" });
      setConfirmingKey(null);
      if (!result.ok) { setFeedback({ tone: "error", text: result.error }); return; }
      setFeedback({ tone: "success", text: `Enviado para ${result.data.recipients} ${result.data.recipients === 1 ? "corretor" : "corretores"}.` });
      setTitle(""); setBody(""); setPeople(new Set());
      router.refresh();
    });
  }

  const enter = reduce ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] as [number, number, number, number] };

  return (
    <div className={`arc-venancor ${styles.page}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1>Recados</h1>
          <p>Avisos, reconhecimentos e pedidos de confirmação para a sua equipe. Chegam no app, no celular e na conversa da Âncora.</p>
        </header>

        <SegmentedControl
          label="Recados"
          value={tab}
          onValueChange={(value) => setTab(value as "new" | "sent")}
          options={[{ value: "new", label: "Novo recado" }, { value: "sent", label: "Enviados", accessory: history.length ? <Badge size="sm">{history.length}</Badge> : undefined }]}
        />

        {tab === "new" ? (
          <motion.div key="new" className={styles.stack} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
            <section className={styles.card} aria-labelledby="rc-who">
              <h2 id="rc-who">Para quem</h2>
              <SegmentedControl label="Para quem" value={audienceKind} onValueChange={(value) => setAudienceKind(value as AudienceKind)} options={audienceOptions} />

              {audienceKind === "people" ? (
                <div className={styles.people}>
                  {selectedBrokers.length ? (
                    <div className={styles.selected} aria-label="Selecionados">
                      {selectedBrokers.map((broker) => (
                        <button type="button" key={broker.id} className={styles.selectedChip} onClick={() => setPeople((current) => toggle(current, broker.id))} aria-label={`Tirar ${broker.name}`}>
                          <Avatar name={broker.name} size="sm" /><span>{firstName(broker.name)}</span><span aria-hidden="true" className={styles.chipX}>×</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <SearchField label="Buscar corretor" placeholder="Nome do corretor" value={search} onValueChange={setSearch} />
                  {brokers.length ? (
                    <ul className={styles.pickList}>
                      {brokers.map((broker) => {
                        const checked = people.has(broker.id);
                        return (
                          <li key={broker.id}>
                            <button type="button" role="checkbox" aria-checked={checked} className={styles.pickRow} onClick={() => setPeople((current) => toggle(current, broker.id))}>
                              <Avatar name={broker.name} size="md" />
                              <span className={styles.pickText}><strong>{broker.name}</strong>{broker.branchName ? <small>{broker.branchName}</small> : null}</span>
                              <span className={styles.check} data-checked={checked}>{checked ? <CheckIcon /> : null}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className={styles.muted}>Nenhum corretor com esse nome.</p>}
                </div>
              ) : null}

              {audienceKind === "duty_today" ? (
                options.dutyTypes.length ? (
                  <div className={styles.typeChips} role="group" aria-label="Tipos de plantão">
                    {options.dutyTypes.map((type) => (
                      <button type="button" key={type.id} className={styles.typeChip} aria-pressed={dutyTypes.has(type.id)} onClick={() => setDutyTypes((current) => toggle(current, type.id))}>{type.name}</button>
                    ))}
                    <small className={styles.muted}>Nenhum marcado = todos os plantões de hoje.</small>
                  </div>
                ) : <p className={styles.muted}>Todos que têm plantão hoje.</p>
              ) : null}

              {audienceKind === "team" ? <p className={styles.muted}>Todos os corretores da sua equipe.</p> : null}

              <div className={styles.reach} aria-live="polite" data-state={preview?.error ? "error" : preview ? (preview.count ? "ok" : "empty") : "idle"}>
                {preview?.error ? preview.error : preview ? (
                  <>
                    <strong>{preview.count === 1 ? "1 corretor" : `${preview.count} corretores`}</strong>
                    {preview.names.length ? <span>{preview.names.slice(0, 3).map(firstName).join(", ")}{preview.count > 3 ? ` e mais ${preview.count - 3}` : ""}</span> : null}
                  </>
                ) : audience ? "Calculando quem recebe..." : "Escolha quem recebe."}
              </div>
            </section>

            <section className={styles.card} aria-labelledby="rc-kind">
              <h2 id="rc-kind">Tipo de recado</h2>
              <RadioCards aria-labelledby="rc-kind" layout="list" options={KINDS} value={kind} onValueChange={(value) => setKind(value as BroadcastKind)} />
            </section>

            <section className={styles.card} aria-labelledby="rc-message">
              <h2 id="rc-message">Mensagem</h2>
              <Input label="Título" id="relationship-title" value={title} maxLength={80} placeholder={PLACEHOLDER[kind]} onChange={(event) => setTitle(event.currentTarget.value)} />
              <div className={styles.textareaWrap}>
                <Textarea label="Texto" id="relationship-body" value={body} maxLength={1000} rows={5} placeholder="Escreva como você falaria com a equipe." onChange={(event) => setBody(event.currentTarget.value)} />
                <span className={styles.counter}>{body.length}/1000</span>
              </div>
            </section>

            {feedback ? <p className={styles.feedback} data-tone={feedback.tone} role="status">{feedback.text}</p> : null}

            <div className={styles.sendBar}>
              {confirming && !pending ? <Button type="button" variant="ghost" onClick={() => setConfirmingKey(null)}>Voltar</Button> : <span className={styles.sendHint}>{ready ? null : missing}</span>}
              <Button type="button" onClick={send} disabled={!ready || pending}>
                {pending ? "Enviando..." : confirming ? `Confirmar envio para ${preview?.count ?? 0}` : "Enviar recado"}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="sent" className={styles.stack} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
            {!history.length ? (
              <EmptyState title="Nenhum recado enviado ainda" description="O primeiro aparece aqui com quem leu e quem confirmou." action={<Button variant="outline" onClick={() => setTab("new")}>Escrever o primeiro</Button>} />
            ) : (
              <ul className={styles.history}>
                {history.map((item) => {
                  const goal = item.requireAck ? item.acked : item.read;
                  const pct = item.recipientsCount ? Math.round((goal / item.recipientsCount) * 100) : 0;
                  return (
                    <li key={item.id}>
                      <button type="button" className={styles.sentCard} onClick={() => setOpenId(item.id)}>
                        <span className={styles.sentTop}>
                          <Badge size="sm" tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
                          <time>{dateTime.format(new Date(item.createdAt))}</time>
                        </span>
                        <strong className={styles.sentTitle}>{item.title}</strong>
                        <span className={styles.sentMeta}>{item.audienceLabel}</span>
                        <span className={styles.progress} aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                        <span className={styles.sentStats}>
                          {item.requireAck ? `${item.acked} de ${item.recipientsCount} confirmaram` : `${item.read} de ${item.recipientsCount} leram`}
                          <span>{pct}%</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </div>

      <RecipientsSheet key={openId ?? "closed"} item={history.find((item) => item.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </div>
  );
}

function RecipientsSheet({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  const [rows, setRows] = useState<Recipient[] | null>(null);
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const itemId = item?.id ?? null;

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    broadcastRecipientsAction(itemId).then((result) => { if (!cancelled) setRows(result.ok ? result.data : []); });
    return () => { cancelled = true; };
  }, [itemId]);

  const pendingOf = (row: Recipient) => (item?.requireAck ? !row.ackAt : !row.readAt);
  const visible = (rows ?? []).filter((row) => filter === "all" || pendingOf(row));
  const pendingCount = (rows ?? []).filter(pendingOf).length;

  return (
    <BottomSheet className="arc-venancor" open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }} title={item?.title ?? "Recado"} description={item ? `${item.audienceLabel} · ${dateTime.format(new Date(item.createdAt))}` : undefined} detents={[0.6, 0.92]} closeLabel="Fechar">
      <div className={styles.sheet}>
        {item ? <p className={styles.sheetBody}>{item.body}</p> : null}
        <SegmentedControl
          label={item?.requireAck ? "Confirmações" : "Leitura"}
          value={filter}
          onValueChange={(value) => setFilter(value as "all" | "pending")}
          options={[{ value: "all", label: "Todos" }, { value: "pending", label: item?.requireAck ? "Não confirmaram" : "Não leram", accessory: rows ? <Badge size="sm">{pendingCount}</Badge> : undefined }]}
        />
        {rows === null ? <p className={styles.muted}>Carregando...</p> : null}
        {rows !== null && !visible.length ? <p className={styles.muted}>{filter === "pending" ? "Todo mundo já viu." : "Ninguém nesse envio."}</p> : null}
        <ul className={styles.recipients}>
          {visible.map((row) => (
            <li key={row.brokerId}>
              <Avatar name={row.name} size="md" />
              <span className={styles.recipientName}>{row.name}</span>
              <span className={styles.recipientState} data-done={!pendingOf(row)}>
                {row.ackAt ? `Ciente ${dateTime.format(new Date(row.ackAt))}` : row.readAt ? `Leu ${dateTime.format(new Date(row.readAt))}` : "Ainda não leu"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  );
}
