"use client";

/**
 * Mensagens da Central de relacionamento no visual Lite do diretor. Mesmas regras e as mesmas Server Actions da tela
 * de hoje (RelationshipCenter): o público vem do servidor (previewAudienceAction), o envio pede confirmação com a
 * contagem e chama sendBroadcastAction com os mesmos argumentos, e o painel de quem leu usa broadcastRecipientsAction.
 */
import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { LiteSelect } from "@/components/lite/controls";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";

import { broadcastRecipientsAction, previewAudienceAction, sendBroadcastAction } from "../../actions";
import type { Audience, AudienceOptions } from "../../audience";
import type { BroadcastKind, BroadcastSummary } from "../../service";
import styles from "./relationship-lite.module.css";

type HistoryItem = Omit<BroadcastSummary, "createdAt"> & { createdAt: string };
type AudienceKind = Audience["kind"];
type Recipient = { brokerId: string; name: string; readAt: string | null; ackAt: string | null };

const KINDS: { id: BroadcastKind; label: string; hint: string }[] = [
  { id: "notice", label: "Aviso", hint: "Informação para a equipe." },
  { id: "recognition", label: "Reconhecimento", hint: "Parabéns por um resultado ou atitude." },
  { id: "confirmation", label: "Pedido de confirmação", hint: "O corretor toca em \"Ciente\" e você vê quem confirmou." },
];
const KIND_LABEL: Record<BroadcastKind, string> = { notice: "Aviso", recognition: "Reconhecimento", confirmation: "Confirmação" };
const KIND_TONE: Record<BroadcastKind, "info" | "success" | "warning"> = { notice: "info", recognition: "success", confirmation: "warning" };
const DATE_TIME: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };

function toggle(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Escolha única em pílulas de 44px (radiogroup), como o seletor da tela de hoje. */
export function LiteChoices<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; count?: number }[]; onChange: (next: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.choices}>
      {options.map((option) => (
        <button key={option.id} type="button" role="radio" aria-checked={value === option.id} className={styles.choice} onClick={() => onChange(option.id)}>
          {option.label}
          {option.count !== undefined ? <span className={styles.choiceCount}>{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Lista de marcar (corretores, unidades, tipos de plantão): linhas de 44px dentro de uma caixa que rola. */
export function LiteCheckList({ label, items, selected, onToggle, empty }: { label: string; items: { id: string; label: string; detail?: string | null }[]; selected: Set<string>; onToggle: (id: string) => void; empty: string }) {
  if (!items.length) return <p className={styles.hint}>{empty}</p>;
  return (
    <ul className={form.checks} aria-label={label}>
      {items.map((item) => (
        <li key={item.id}>
          <label className={form.check}>
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => onToggle(item.id)} />
            <span className={styles.recipientName}>{item.label}</span>
            {item.detail ? <span className={styles.recipientState}>{item.detail}</span> : null}
          </label>
        </li>
      ))}
    </ul>
  );
}

export function RelationshipMessagesLite({ options, history }: { options: AudienceOptions; history: HistoryItem[] }) {
  const router = useRouter();
  const titleId = useId();
  const bodyId = useId();
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

  // Mesmas opções de público da tela de hoje, pelas mesmas regras de papel.
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

  // A contagem sempre vem do servidor (a mesma resolução do envio); trocar o público descarta a contagem e a confirmação.
  const audienceKey = JSON.stringify(audience);
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

  const openItem = history.find((item) => item.id === openId) ?? null;

  return (
    <div className={styles.messages}>
      <section className={page.card} aria-labelledby="composer-title">
        <header className={page.cardHead}>
          <h2 id="composer-title" className={page.cardTitle}>Nova mensagem</h2>
          <p className={page.cardDescription}>Chega no app do corretor, no celular (push) e na conversa da Âncora.</p>
        </header>

        <div className={styles.block}>
          <p className={styles.blockTitle}>Para quem</p>
          <LiteChoices label="Para quem" value={audienceKind} options={audienceOptions} onChange={setAudienceKind} />
        </div>

        {audienceKind === "people" ? (
          <div className={styles.block}>
            <div className={`${page.search} ${styles.searchFull}`}>
              <Search aria-hidden="true" size={16} className={page.searchIcon} />
              <input className={page.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar corretor" aria-label="Buscar corretor" />
            </div>
            <LiteCheckList label="Corretores" items={filteredBrokers} selected={people} onToggle={(id) => setPeople((current) => toggle(current, id))} empty="Nenhum corretor encontrado." />
          </div>
        ) : null}
        {audienceKind === "branches" ? (
          <LiteCheckList label="Unidades" items={options.branches.map((branch) => ({ id: branch.id, label: branch.name }))} selected={branches} onToggle={(id) => setBranches((current) => toggle(current, id))} empty="Nenhuma unidade no seu escopo." />
        ) : null}
        {audienceKind === "duty_today" ? (
          <div className={styles.block}>
            <p className={styles.hint}>Quem tem plantão hoje. Marque tipos para filtrar, ou deixe vazio para todos os plantões.</p>
            <LiteCheckList label="Tipos de plantão" items={options.dutyTypes.map((type) => ({ id: type.id, label: type.name }))} selected={dutyTypes} onToggle={(id) => setDutyTypes((current) => toggle(current, id))} empty="Nenhum tipo de plantão cadastrado." />
          </div>
        ) : null}
        {audienceKind === "team" && options.role !== "supervisor" ? (
          <LiteSelect label="Supervisor da equipe" value={supervisorId} placeholder="Escolha o supervisor" searchPlaceholder="Buscar supervisor" options={options.supervisors.map((supervisor) => ({ value: supervisor.id, label: supervisor.name }))} onChange={setSupervisorId} />
        ) : null}
        {audienceKind === "team" && options.role === "supervisor" ? <p className={styles.hint}>Os corretores da sua equipe.</p> : null}
        {audienceKind === "all" ? <p className={styles.hint}>Todos os corretores ativos da empresa.</p> : null}

        <div aria-live="polite" className={`${styles.block} ${styles.live}`}>
          {preview?.error ? <p className={styles.error}>{preview.error}</p> : null}
          {preview && !preview.error ? (
            <p className={styles.preview}>
              <span>Vai para <span className={styles.previewCount}>{preview.count} {preview.count === 1 ? "corretor" : "corretores"}</span></span>
              {preview.count > 0 ? (
                <button type="button" className={styles.linkButton} aria-expanded={showNames} onClick={() => setShowNames((value) => !value)}>
                  {showNames ? "Esconder nomes" : "Ver nomes"}
                </button>
              ) : null}
            </p>
          ) : null}
          {showNames && preview?.names.length ? <p className={styles.names}>{preview.names.join(", ")}{preview.count > preview.names.length ? ` e mais ${preview.count - preview.names.length}` : ""}</p> : null}
        </div>

        <div className={styles.block}>
          <p className={styles.blockTitle}>Tipo</p>
          <LiteChoices label="Tipo" value={kind} options={KINDS} onChange={setKind} />
          <p className={styles.hint}>{KINDS.find((item) => item.id === kind)?.hint}</p>
        </div>

        <div className={form.field}>
          <label htmlFor={titleId} className={form.label}>Título</label>
          <input id={titleId} className={form.input} value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "recognition" ? "Parabéns pelo plantão de ontem" : "Escala de novembro publicada"} />
        </div>
        <div className={form.field}>
          <div className={styles.counterRow}>
            <label htmlFor={bodyId} className={form.label}>Mensagem</label>
            <span className={styles.counter}>{body.length}/1000</span>
          </div>
          <textarea id={bodyId} className={form.textarea} value={body} maxLength={1000} rows={5} onChange={(event) => setBody(event.target.value)} placeholder="Escreva como você falaria com a equipe." />
        </div>

        <div className={styles.block}>
          <p className={styles.blockTitle}>Canal</p>
          <ul className={styles.choices} aria-label="Canal">
            <li><span className={styles.choice} data-static="true" aria-checked="true">Só no sistema</span></li>
            <li><span className={styles.choice} data-static="true" aria-disabled="true" title="Chega na próxima etapa">Sistema + WhatsApp (em breve)</span></li>
          </ul>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerButtons}>
            <button type="button" className={`${page.primaryButton} ${styles.primary}`} onClick={send} disabled={!ready || pending}>
              {pending ? "Enviando..." : confirming ? `Confirmar envio para ${preview?.count ?? 0}` : "Enviar"}
            </button>
            {confirming && !pending ? <button type="button" className={page.button} onClick={() => setConfirming(false)}>Voltar</button> : null}
          </div>
          {feedback ? <p role="status" className={styles.feedback} data-tone={feedback.tone}>{feedback.text}</p> : null}
        </div>
      </section>

      <section className={page.card} aria-labelledby="history-title">
        <header className={page.cardHead}>
          <h2 id="history-title" className={page.cardTitle}>Enviadas</h2>
          <p className={page.cardDescription}>Toque numa mensagem para ver quem leu e quem confirmou.</p>
        </header>
        {!history.length ? (
          <div className={page.empty}>
            <p className={page.emptyText}>Nenhuma mensagem enviada ainda. A primeira aparece aqui com quem leu.</p>
          </div>
        ) : (
          <ul className={styles.rows}>
            {history.map((item) => {
              const readPct = item.recipientsCount ? Math.round((item.read / item.recipientsCount) * 100) : 0;
              return (
                <li key={item.id}>
                  <button type="button" className={styles.row} onClick={() => setOpenId(item.id)}>
                    <span className={styles.rowHead}>
                      <span className={styles.rowText}>
                        <span className={styles.rowTitle}>{item.title}</span>
                        <span className={styles.rowMeta}>{item.audienceLabel} · {item.senderName} · {formatLiteDate(item.createdAt, DATE_TIME)}</span>
                      </span>
                      <span className={page.badge} data-tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</span>
                    </span>
                    <span className={styles.track} aria-hidden="true"><span className={styles.fill} style={{ width: `${readPct}%` }} /></span>
                    <span className={styles.rowMeta}>
                      {item.read} de {item.recipientsCount} leram
                      {item.requireAck ? ` · ${item.acked} confirmaram` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <RecipientsPanel key={openId ?? "closed"} item={openItem} onClose={() => setOpenId(null)} />
    </div>
  );
}

function RecipientsPanel({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  const [rows, setRows] = useState<Recipient[] | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const itemId = item?.id ?? null;

  // Chaveado pelo item no pai: um item novo começa do zero.
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
    <LiteSidePanel
      open={Boolean(item)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={item?.title ?? ""}
      description={item ? `${item.audienceLabel} · ${formatLiteDate(item.createdAt, DATE_TIME)}` : undefined}
    >
      {item ? (
        <div className={styles.panelStack}>
          <p className={styles.message}>{item.body}</p>
          <div className={styles.panelHead}>
            <h3 className={styles.blockTitle}>{item.requireAck ? "Confirmações" : "Leitura"}</h3>
            <button type="button" className={`${page.button} ${styles.toggle}`} aria-pressed={onlyPending} onClick={() => setOnlyPending((value) => !value)}>
              {item.requireAck ? "Só quem não confirmou" : "Só quem não leu"}
            </button>
          </div>
          {rows === null ? <p className={styles.status}>Carregando...</p> : null}
          {rows !== null && !visible.length ? <p className={styles.status}>{onlyPending ? "Todo mundo já viu." : "Ninguém nesse envio."}</p> : null}
          <ul className={styles.recipients}>
            {visible.map((row) => (
              <li key={row.brokerId}>
                <span className={styles.recipientName}>{row.name}</span>
                <span className={styles.recipientState} data-done={pendingOf(row) ? undefined : "true"}>
                  {row.ackAt ? `Ciente ${formatLiteDate(row.ackAt, DATE_TIME)}` : row.readAt ? `Leu ${formatLiteDate(row.readAt, DATE_TIME)}` : "Ainda não leu"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </LiteSidePanel>
  );
}
