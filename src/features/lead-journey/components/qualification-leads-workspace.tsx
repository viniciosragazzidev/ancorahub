"use client";

/**
 * Leads na qualificação (/qualificacao/leads, plano de recuperação §8.2), visual Lite.
 * Uma tabela com a etapa de cada lead (abas com contagem), busca, e o drawer com a linha do tempo da qualificação.
 * Dia a dia: "J" e "K" passam para o próximo / anterior lead da mesma aba com o drawer aberto; telefone copia num
 * clique. Nada aqui manda mensagem: o único verbo que muda dado é "Não contatar" (no menu ⋯).
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { LiteFilterChips, LiteMenu } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import page from "@/components/lite/page/lite-page.module.css";
import { Kbd } from "@/components/ui/kbd";
import { formatLeadPhone } from "@/features/leads/format-lead-phone";
import { useDevLab } from "@/lib/dev-lab";

import { getLeadTimelineAction, markDoNotContactAction } from "../actions";
import { formatElapsed } from "../journey";
import { JOURNEY_TABS, rowsForTab, type QualificationLeadRow } from "../rows";
import type { TimelineItem } from "../timeline";
import { LeadJourneyView } from "./lead-journey-view";
import { QualificationTimeline } from "./qualification-timeline";

export type QualificationLeadsServices = {
  timeline: (leadId: string) => Promise<{ ok: true; data: { items: TimelineItem[] } } | { ok: false; error: string }>;
  doNotContact: (leadId: string) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
};

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function timeAgo(iso: string | null, now: Date) {
  return iso ? `há ${formatElapsed(new Date(iso), now)}` : "—";
}

export function QualificationLeadsWorkspace({ rows, filters, summary, truncated = false, nowIso }: {
  rows: QualificationLeadRow[];
  /** Intervalo e fila (seletores de URL na página; nada no laboratório). */
  filters?: ReactNode;
  /** Entradas por turno (EntriesView) acima da tabela. */
  summary?: ReactNode;
  truncated?: boolean;
  nowIso: string;
}) {
  const router = useRouter();
  const lab = useDevLab();
  const services: QualificationLeadsServices = lab?.qualificationLeads ?? { timeline: (leadId) => getLeadTimelineAction({ leadId }), doNotContact: (leadId) => markDoNotContactAction({ leadId }) };
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [marked, setMarked] = useState<Set<string>>(() => new Set());
  const notice = useActionNotice();

  const counts = useMemo(() => Object.fromEntries(JOURNEY_TABS.map((item) => [item.id, rowsForTab(rows, item.id).length])), [rows]);
  const needle = normalize(query.trim());
  const tabRows = rowsForTab(rows, tab);
  const visible = needle ? tabRows.filter((row) => normalize(row.name).includes(needle) || (row.phone ?? "").replace(/\D/g, "").includes(needle.replace(/\D/g, "") || "§")) : tabRows;
  const pages = useLitePages(visible, 20);
  const open = openId ? rows.find((row) => row.id === openId) ?? null : null;

  // J / K: próximo e anterior da mesma lista, com o drawer aberto (atalho do dia a dia).
  const step = useCallback((delta: number) => {
    if (!openId) return;
    const index = visible.findIndex((row) => row.id === openId);
    const next = visible[index + delta];
    if (next) setOpenId(next.id);
  }, [openId, visible]);
  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "j" || event.key === "J") { event.preventDefault(); step(1); }
      if (event.key === "k" || event.key === "K") { event.preventDefault(); step(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, step]);

  const copyPhone = (phone: string | null) => {
    if (!phone) return;
    void navigator.clipboard?.writeText(phone.replace(/\D/g, "")).then(() => notice.succeed("Telefone copiado.")).catch(() => undefined);
  };
  const doNotContact = async (row: QualificationLeadRow) => {
    notice.tap();
    const result = await services.doNotContact(row.id).catch(() => ({ ok: false as const, error: "Sem conexão agora." }));
    if (!result.ok) { notice.fail(result.error, { keeps: "O lead continua como estava.", retry: () => void doNotContact(row) }); return; }
    setMarked((current) => new Set(current).add(row.id));
    notice.succeed(`${row.name} não recebe mais mensagem automática.`);
    if (!lab) router.refresh();
  };

  const columns: LiteColumn<QualificationLeadRow>[] = [
    {
      id: "lead", label: "Lead", primary: true,
      render: (row) => (
        <span>
          <span className={page.cellTitle}>{row.name}</span>
          <span className={page.cellSub}>{row.queueName ?? "Sem fila"} · entrou {timeAgo(row.createdAt, now)}</span>
        </span>
      ),
    },
    { id: "journey", label: "Etapa", render: (row) => (marked.has(row.id) ? <span className={page.badge} data-tone="danger">Não contatar</span> : <LeadJourneyView journey={row.journey} variant="compact" />) },
    { id: "field", label: "Campo atual", secondary: true, render: (row) => row.field ?? <span className={page.muted}>—</span> },
    { id: "touches", label: "Lembretes", numeric: true, nowrap: true, render: (row) => (row.touches.sent ? `${row.touches.sent} de ${row.touches.total}` : <span className={page.muted}>Nenhum</span>) },
    { id: "reply", label: "Última resposta", numeric: true, nowrap: true, render: (row) => (row.lastInboundAt ? timeAgo(row.lastInboundAt, now) : <span className={page.muted}>Nunca</span>) },
    {
      id: "menu", label: "Ações", nowrap: true,
      render: (row) => (
        <span onClick={(event) => event.stopPropagation()}>
          <LiteMenu
            label={`Ações de ${row.name}`}
            items={[
              { id: "open", label: "Ver linha do tempo", onSelect: () => setOpenId(row.id) },
              ...(row.phone ? [{ id: "copy", label: "Copiar telefone", onSelect: () => copyPhone(row.phone) }] : []),
              { id: "ficha", label: "Abrir ficha do lead", href: `/leads/${row.id}` },
              ...(row.journey.code !== "X1" && !marked.has(row.id) ? [{ id: "dnc", label: "Não contatar", tone: "danger" as const, onSelect: () => void doNotContact(row) }] : []),
            ]}
          />
        </span>
      ),
    },
  ];

  const hot = counts.hot ?? 0;
  const stopped = counts.stopped ?? 0;
  const never = counts.never ?? 0;

  return (
    <>
      <section className={page.group} aria-labelledby="qualification-leads-title">
        <header className={page.cardHead}>
          <h2 id="qualification-leads-title" className={page.cardTitle}>Leads na qualificação ({rows.length.toLocaleString("pt-BR")}{truncated ? "+" : ""})</h2>
          <p className={page.cardDescription}>
            Onde cada lead está, o que falta e o que acontece depois. {hot.toLocaleString("pt-BR")} quentes, {stopped.toLocaleString("pt-BR")} pararam no meio e {never.toLocaleString("pt-BR")} nunca responderam.
          </p>
        </header>
        {filters ? <div className={page.toolbar}>{filters}</div> : null}
        {summary}
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input className={page.searchInput} value={query} onChange={(event) => { setQuery(event.target.value); pages.reset(); }} placeholder="Buscar por nome ou telefone" aria-label="Buscar lead" />
          </label>
        </div>
        <LiteFilterChips
          scroll
          label="Filtrar por etapa"
          active={[tab]}
          onToggle={(id) => { setTab(id); pages.reset(); }}
          chips={JOURNEY_TABS.map((item) => ({ id: item.id, label: item.label, count: counts[item.id] ?? 0 }))}
        />
        {needle ? (
          <p className={page.resultLine}>
            {visible.length} de {tabRows.length} leads contêm “{query.trim()}” · <button type="button" onClick={() => setQuery("")}>Limpar busca</button>
          </p>
        ) : null}
        <ActionNoticeLine notice={notice.notice} />
        <LiteResponsiveData
          caption="Leads na qualificação"
          columns={columns}
          rows={pages.pageRows}
          rowKey={(row) => row.id}
          onRowOpen={(row) => setOpenId(row.id)}
          rowTone={(row) => (row.journey.tone === "pending" && row.journey.code.startsWith("N") ? "warning" : row.journey.code === "X1" || marked.has(row.id) ? "muted" : undefined)}
          empty={<p className={page.emptyText}>Nenhum lead nesta etapa no período.</p>}
        />
        <LitePagination {...pages.pagination} label="Páginas dos leads" />
        <p className={page.resultLine}>{visible.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} leads{truncated ? " (mostrando os mais recentes)" : ""}</p>
      </section>

      <LiteSidePanel
        open={Boolean(open)}
        onOpenChange={(value) => { if (!value) setOpenId(null); }}
        title={open?.name ?? "Lead"}
        description={open ? [open.phone ? formatLeadPhone(open.phone) : null, open.queueName ?? "Sem fila", open.brokerName ? `Corretor: ${open.brokerName}` : null].filter(Boolean).join(" · ") : undefined}
      >
        {open ? (
          <LeadTimelinePanel key={open.id} row={open} services={services} onCopyPhone={() => copyPhone(open.phone)} hasNeighbors={visible.length > 1} />
        ) : null}
      </LiteSidePanel>
    </>
  );
}

function LeadTimelinePanel({ row, services, onCopyPhone, hasNeighbors }: { row: QualificationLeadRow; services: QualificationLeadsServices; onCopyPhone: () => void; hasNeighbors: boolean }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ready"; items: TimelineItem[] } | { status: "error"; error: string }>({ status: "loading" });
  const load = useCallback(() => {
    setState({ status: "loading" });
    services.timeline(row.id)
      .then((result) => setState(result.ok ? { status: "ready", items: result.data.items } : { status: "error", error: result.error }))
      .catch(() => setState({ status: "error", error: "Sem conexão agora." }));
  }, [row.id, services]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-ds-16">
      <LeadJourneyView journey={row.journey} />
      <div className="flex flex-wrap items-center gap-ds-8">
        {row.phone ? <button type="button" className={page.button} onClick={onCopyPhone}>Copiar telefone</button> : null}
        <a className={page.button} href={`/leads/${row.id}`}>Abrir ficha</a>
        {hasNeighbors ? <span className="ml-auto text-ds-caption text-ds-fog"><Kbd>J</Kbd> próximo · <Kbd>K</Kbd> anterior</span> : null}
      </div>
      <div className="flex flex-col gap-ds-8">
        <p className="text-ds-caption font-medium uppercase tracking-wide text-ds-fog">Linha do tempo da qualificação</p>
        {state.status === "loading" ? <p className="text-ds-body text-ds-fog" aria-live="polite">Carregando…</p> : null}
        {state.status === "error" ? (
          <p className="text-ds-body text-ds-rose-ink" role="alert">
            {state.error} A etapa acima continua valendo. <button type="button" className="underline" onClick={load}>Tentar de novo</button>
          </p>
        ) : null}
        {state.status === "ready" ? <QualificationTimeline items={state.items} /> : null}
      </div>
    </div>
  );
}
