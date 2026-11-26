"use client";

/**
 * "LGPD" em /settings no visual Lite (26/11), só para o diretor: os pedidos do titular com o prazo de 15 dias
 * corridos. Abertos primeiro, o que vence antes no topo. Exportar e anonimizar na ficha do lead concluem o pedido
 * sozinhos; "Registrar pedido" guarda o que chegou por e-mail ou telefone e ainda não foi atendido.
 *
 * Feedback (FEEDBACK.md, nível 1): registrar confirma no botão só depois do servidor; a falha mostra a causa, o que
 * continua valendo e "Tentar de novo". Prazo e situação sempre com texto, a cor do status só reforça.
 */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { LiteActionButton, LiteMenu, LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import styles from "@/components/lite/page/lite-sections.module.css";
import {
  brasiliaDay,
  countLgpdAttention,
  describeLgpdDeadline,
  describeLgpdSituation,
  formatLgpdDate,
  LGPD_REQUEST_DEADLINE_DAYS,
  LGPD_REQUEST_KIND_LABEL,
  MAX_LGPD_REQUEST_REASON_LENGTH,
  sortLgpdRequests,
  validateRegisterLgpdRequest,
  type LgpdRequestKind,
} from "@/features/leads/lgpd/lgpd-requests";
import { registerLgpdRequestAction, searchLgpdLeadsAction, type LgpdLeadOption } from "@/features/leads/lgpd/lgpd-requests-actions";
import type { LgpdRequestRow } from "@/features/leads/lgpd/lgpd-requests-store";

type Row = LgpdRequestRow & { due: Date; done: Date | null };

const toRow = (row: LgpdRequestRow): Row => ({ ...row, due: new Date(row.dueAt), done: row.completedAt ? new Date(row.completedAt) : null });
const sortRows = (rows: Row[]) => sortLgpdRequests(rows.map((row) => ({ ...row, dueAt: row.due, completedAt: row.done }))).map((row) => rows.find((item) => item.id === row.id)!);

function Badge({ label, tone }: { label: string; tone: string | null }) {
  return <span className={page.badge} data-tone={tone ?? undefined}>{label}</span>;
}

export function LgpdRequestsLite({ ready, initialRows }: { ready: boolean; initialRows: LgpdRequestRow[] }) {
  const [rows, setRows] = useState<Row[]>(() => sortRows(initialRows.map(toRow)));
  const [openId, setOpenId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const now = useMemo(() => new Date(), []);
  const open = rows.find((row) => row.id === openId) ?? null;
  const attention = countLgpdAttention(rows.map((row) => ({ dueAt: row.due, completedAt: row.done })), now);
  const openCount = rows.filter((row) => !row.done).length;

  const columns: LiteColumn<Row>[] = [
    {
      id: "holder",
      label: "Titular",
      primary: true,
      render: (row) => <span className={row.anonymized ? page.muted : page.cellTitle}>{row.anonymized ? "Titular anonimizado" : row.holder}</span>,
    },
    { id: "kind", label: "Tipo", secondary: true, render: (row) => LGPD_REQUEST_KIND_LABEL[row.kind] },
    { id: "requested", label: "Pedido em", render: (row) => <span className="tabular-nums">{formatLgpdDate(new Date(row.requestedAt))}</span> },
    {
      id: "due",
      label: "Prazo",
      render: (row) => {
        const deadline = describeLgpdDeadline({ dueAt: row.due, completedAt: row.done }, now);
        return (
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{formatLgpdDate(row.due)}</span>
            <Badge label={deadline.label} tone={deadline.tone} />
          </span>
        );
      },
    },
    {
      id: "situation",
      label: "Situação",
      render: (row) => {
        const situation = describeLgpdSituation({ dueAt: row.due, completedAt: row.done }, now);
        return <Badge label={situation.label} tone={situation.tone} />;
      },
    },
    {
      id: "actions",
      label: "Ações",
      render: (row) => (
        <LiteMenu
          label={`Ações do pedido de ${row.anonymized ? "titular anonimizado" : row.holder}`}
          items={[
            { id: "details", label: "Ver pedido", onSelect: () => setOpenId(row.id) },
            { id: "lead", label: "Abrir ficha do lead", href: `/leads/${row.leadId}` },
          ]}
        />
      ),
    },
  ];

  if (!ready) {
    return (
      <section className={styles.group} aria-labelledby="lgpd-title">
        <div className={styles.row}>
          <div className={styles.rowText}>
            <h3 id="lgpd-title" className={styles.rowTitle}>Pedidos do titular</h3>
            <p className={styles.rowDescription}>O registro de pedidos ainda não está pronto nesta empresa. Exportar e anonimizar na ficha do lead seguem funcionando.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.group} aria-labelledby="lgpd-title">
      <div className={styles.row}>
        <div className={styles.rowText}>
          <h3 id="lgpd-title" className={styles.rowTitle}>Pedidos do titular</h3>
          <p className={styles.rowDescription}>
            Exportar ou anonimizar em até {LGPD_REQUEST_DEADLINE_DAYS} dias corridos. Atender na ficha do lead conclui o pedido.
          </p>
        </div>
        <button type="button" className={page.primaryButton} onClick={() => setRegistering(true)}>
          <Plus aria-hidden="true" size={16} />
          Registrar pedido
        </button>
      </div>
      {openCount ? (
        <p className={styles.note} role="status">
          <span className="tabular-nums">{openCount}</span> {openCount === 1 ? "pedido em aberto" : "pedidos em aberto"}
          {attention.overdue ? <>, <span className="tabular-nums">{attention.overdue}</span> {attention.overdue === 1 ? "vencido" : "vencidos"}</> : null}
          {attention.soon ? <>, <span className="tabular-nums">{attention.soon}</span> {attention.soon === 1 ? "vence" : "vencem"} em até 3 dias</> : null}.
        </p>
      ) : null}
      <LiteResponsiveData
        caption="Pedidos do titular"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowOpen={(row) => setOpenId(row.id)}
        empty={<p className={page.emptyText}>Nenhum pedido do titular ainda.</p>}
      />

      <LiteSidePanel
        open={Boolean(open)}
        onOpenChange={(value) => { if (!value) setOpenId(null); }}
        title={open ? LGPD_REQUEST_KIND_LABEL[open.kind] : "Pedido"}
        description={open ? (open.anonymized ? "Titular anonimizado" : open.holder) : undefined}
      >
        {open ? <RequestDetails row={open} now={now} /> : null}
      </LiteSidePanel>

      <LiteSidePanel open={registering} onOpenChange={setRegistering} title="Registrar pedido" description="Pedido que chegou por e-mail ou telefone">
        {registering ? (
          <RegisterRequestForm
            onRegistered={(row) => setRows((current) => sortRows([toRow(row), ...current]))}
            existing={rows}
          />
        ) : null}
      </LiteSidePanel>
    </section>
  );
}

function RequestDetails({ row, now }: { row: Row; now: Date }) {
  const deadline = describeLgpdDeadline({ dueAt: row.due, completedAt: row.done }, now);
  const situation = describeLgpdSituation({ dueAt: row.due, completedAt: row.done }, now);
  const how = row.kind === "export" ? "Exportar dados do titular" : "Anonimizar titular";
  return (
    <div className={form.form}>
      <dl className={form.summary}>
        <div><dt>Pedido em</dt><dd className="tabular-nums">{formatLgpdDate(new Date(row.requestedAt))}</dd></div>
        <div><dt>Prazo</dt><dd><span className="tabular-nums">{formatLgpdDate(row.due)}</span> <Badge label={deadline.label} tone={deadline.tone} /></dd></div>
        <div><dt>Situação</dt><dd><Badge label={situation.label} tone={situation.tone} /></dd></div>
        {row.done ? <div><dt>Atendido</dt><dd><span className="tabular-nums">{formatLgpdDate(row.done)}</span>{row.completedByName ? `, por ${row.completedByName}` : ""}</dd></div> : null}
        {row.reason ? <div><dt>Motivo</dt><dd>{row.reason}</dd></div> : null}
      </dl>
      {!row.done ? <p className={styles.note}>Para atender, abra a ficha do lead e use {how} no menu do perfil. O pedido fica atendido sozinho.</p> : null}
      <div className={form.actions}>
        <a className={row.done ? page.button : page.primaryButton} href={`/leads/${row.leadId}`}>Abrir ficha do lead</a>
      </div>
    </div>
  );
}

function RegisterRequestForm({ onRegistered, existing }: { onRegistered: (row: LgpdRequestRow) => void; existing: Row[] }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<LgpdLeadOption[] | null>(null);
  const [lead, setLead] = useState<LgpdLeadOption | null>(null);
  const [kind, setKind] = useState<LgpdRequestKind | "">("");
  const [requestedOn, setRequestedOn] = useState(() => brasiliaDay(new Date()));
  const [reason, setReason] = useState("");
  const today = brasiliaDay(new Date());
  const check = validateRegisterLgpdRequest({ leadId: lead?.id ?? "", kind, reason, requestedOn });
  const duplicated = Boolean(lead && kind && existing.some((row) => row.leadId === lead.id && row.kind === kind && !row.done));

  async function search() {
    const term = query.trim();
    if (term.length < 2) return;
    setSearching(true);
    setSearchError(null);
    const result = await searchLgpdLeadsAction(term).catch(() => ({ ok: false as const, error: "Não deu para buscar agora." }));
    setSearching(false);
    if (!result.ok) { setSearchError(result.error); return; }
    setResults(result.leads);
  }

  return (
    <div className={form.form}>
      {lead ? (
        <div className={form.field}>
          <span className={form.label}>Titular</span>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={styles.itemText}>
              <span className={styles.itemTitle}>{lead.label}</span>
              <span className={styles.itemSub}>{lead.detail}</span>
            </span>
            <button type="button" className={page.button} onClick={() => { setLead(null); setResults(null); }}>Trocar</button>
          </div>
        </div>
      ) : (
        <div className={form.field}>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); void search(); }}>
            <label className={form.field} style={{ flex: "1 1 200px" }}>
              <span className={form.label}>Buscar lead</span>
              <input className={form.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou telefone" maxLength={80} />
            </label>
            <button type="submit" className={page.button} disabled={searching || query.trim().length < 2} aria-busy={searching || undefined}>
              {searching ? "Buscando…" : "Buscar"}
            </button>
          </form>
          {searchError ? <p className={styles.error} role="alert">{searchError} Tente de novo.</p> : null}
          {results && !results.length ? <p className={form.hint}>Nenhum lead com esse nome ou telefone.</p> : null}
          {results?.length ? (
            <ul className={styles.list} aria-label="Leads encontrados">
              {results.map((option) => (
                <li key={option.id}>
                  <button type="button" className={styles.itemButton} onClick={() => setLead(option)}>
                    <span className={styles.itemText}>
                      <span className={styles.itemTitle}>{option.label}</span>
                      <span className={styles.itemSub}>{option.detail}</span>
                    </span>
                    <Plus aria-hidden="true" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      <LiteSelect
        label="Tipo"
        value={kind}
        onChange={(value) => setKind(value as LgpdRequestKind)}
        placeholder="Escolha o tipo"
        options={[
          { value: "export", label: LGPD_REQUEST_KIND_LABEL.export },
          { value: "anonymize", label: LGPD_REQUEST_KIND_LABEL.anonymize },
        ]}
      />
      <label className={form.field}>
        <span className={form.label}>Dia do pedido</span>
        <input className={form.input} type="date" value={requestedOn} max={today} onChange={(event) => setRequestedOn(event.target.value)} />
        <span className={form.hint}>O prazo de {LGPD_REQUEST_DEADLINE_DAYS} dias conta de quando o titular pediu.</span>
      </label>
      <label className={form.field}>
        <span className={form.label}>Como o pedido chegou</span>
        <textarea className={form.textarea} rows={3} value={reason} maxLength={MAX_LGPD_REQUEST_REASON_LENGTH} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: e-mail do titular em 20/11" />
      </label>
      {check.ok ? <p className={form.hint}>Vence em <span className="tabular-nums">{formatLgpdDate(check.dueAt)}</span>.</p> : null}
      {duplicated ? <p className={form.hint}>Já existe um pedido aberto deste tipo para este titular.</p> : null}
      <div className={form.actions}>
        <LiteActionButton
          busyLabel="Registrando…"
          doneLabel="Registrado"
          disabled={!check.ok || duplicated}
          keeps="Nenhum pedido foi registrado."
          errorFallback="Não deu para registrar o pedido agora."
          onAction={async () => {
            if (!check.ok || !kind || !lead) return { ok: false, message: "Preencha o pedido." };
            const result = await registerLgpdRequestAction({ leadId: lead.id, kind, reason, requestedOn });
            if (!result.ok) return { ok: false, message: result.error };
            onRegistered(result.row);
            return { ok: true };
          }}
        >
          Registrar
        </LiteActionButton>
      </div>
    </div>
  );
}
