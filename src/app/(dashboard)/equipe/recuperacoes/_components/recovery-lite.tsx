"use client";

/**
 * Recuperação de senha no visual Lite: os mesmos três números, a lista Lite (tabela no desktop, cartões no celular)
 * com busca e status, e as mesmas Server Actions de aprovar e rejeitar. Aprovar segue sem confirmação, como hoje;
 * rejeitar abre a confirmação Lite com a justificativa opcional; a justificativa salva abre no painel lateral.
 */
import { useMemo, useState, useTransition } from "react";
import { Check, Eye, Search, X } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteConfirmDialog, LiteFilterChips } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { dailyCounts } from "@/shared/trends";

import { approveResetAction, rejectResetAction, type RecoveryActionState } from "../actions";
import styles from "./recovery-lite.module.css";

export type RecoveryLiteRequest = {
  id: string;
  userId: string;
  userEmail: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  directorNotes: string | null;
  userName: string;
};

const STATUS: Record<string, { label: string; tone?: "success" | "warning" | "danger" }> = {
  requested: { label: "Pendente", tone: "warning" },
  approved: { label: "Aprovada", tone: "success" },
  rejected: { label: "Rejeitada", tone: "danger" },
  completed: { label: "Concluída", tone: "success" },
};

const DATE_TIME = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" } as const;

type StatusFilter = "all" | "requested" | "approved" | "rejected" | "completed";

function outcome(request: RecoveryLiteRequest) {
  if (request.status === "approved") return "Link enviado";
  if (request.status === "completed") return "Senha redefinida";
  if (request.status === "rejected") return request.directorNotes ? "Com justificativa" : "Sem justificativa";
  return "Sem análise";
}

function report(result: RecoveryActionState) {
  if (result.message) toast.success(result.message);
  if (result.error) toast.error(result.error);
}

export function RecoveryLite({ requests }: { requests: RecoveryLiteRequest[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rejecting, setRejecting] = useState<RecoveryLiteRequest | null>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState<RecoveryLiteRequest | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const counts = useMemo(() => {
    const by = (value: string) => requests.filter((request) => request.status === value).length;
    return { all: requests.length, requested: by("requested"), approved: by("approved"), rejected: by("rejected"), completed: by("completed") };
  }, [requests]);

  const trends = useMemo(() => ({
    pending: dailyCounts(requests.filter((request) => request.status === "requested").map((request) => new Date(request.createdAt))),
    resolved: dailyCounts(requests.filter((request) => request.status === "approved" || request.status === "rejected").map((request) => new Date(request.reviewedAt ?? request.createdAt))),
    all: dailyCounts(requests.map((request) => new Date(request.createdAt))),
  }), [requests]);

  const rows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return requests
      .filter((request) => status === "all" || request.status === status)
      .filter((request) => !needle || [request.userName, request.userEmail].some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [requests, status, query]);
  const { pageRows, pagination } = useLitePages(rows, 10);

  const run = (id: string, action: typeof approveResetAction, data: FormData) => {
    setPendingId(id);
    startTransition(async () => {
      try {
        report(await action({}, data));
      } finally {
        setPendingId(null);
      }
    });
  };

  const approve = (request: RecoveryLiteRequest) => {
    const data = new FormData();
    data.set("requestId", request.id);
    run(request.id, approveResetAction, data);
  };

  const confirmReject = () => {
    if (!rejecting) return;
    const data = new FormData();
    data.set("requestId", rejecting.id);
    if (reason) data.set("reason", reason);
    run(rejecting.id, rejectResetAction, data);
    setRejecting(null);
    setReason("");
  };

  const columns: LiteColumn<RecoveryLiteRequest>[] = [
    {
      id: "person",
      label: "Membro",
      primary: true,
      render: (request) => (
        <span>
          <span className={page.cellTitle}>{request.userName}</span>
          <span className={page.cellSub}>{request.userEmail}</span>
        </span>
      ),
    },
    { id: "status", label: "Status", render: (request) => <span className={page.badge} data-tone={STATUS[request.status]?.tone}>{STATUS[request.status]?.label ?? request.status}</span> },
    { id: "created", label: "Solicitada em", render: (request) => <span className={page.numeric}>{formatLiteDate(request.createdAt, DATE_TIME)}</span> },
    {
      id: "review",
      label: "Análise",
      render: (request) => (
        <span className={styles.review}>
          <span>
            <span className={page.numeric}>{request.reviewedAt ? formatLiteDate(request.reviewedAt, DATE_TIME) : "Sem análise"}</span>
          </span>
          {request.directorNotes ? (
            <button type="button" className={page.iconButton} aria-label={`Ver justificativa de ${request.userName}`} title="Ver justificativa" onClick={() => setDetails(request)}>
              <Eye aria-hidden="true" size={18} />
            </button>
          ) : null}
        </span>
      ),
    },
    {
      id: "actions",
      label: "Ações",
      numeric: true,
      render: (request) => request.status === "requested" ? (
        <span className={styles.actions}>
          <button type="button" className={page.primaryButton} disabled={pendingId === request.id} onClick={() => approve(request)}>
            <Check aria-hidden="true" size={16} />{pendingId === request.id ? "Aprovando..." : "Aprovar"}
          </button>
          <button type="button" className={page.iconButton} data-tone="danger" aria-label={`Rejeitar a solicitação de ${request.userName}`} title="Rejeitar" disabled={pendingId === request.id} onClick={() => setRejecting(request)}>
            <X aria-hidden="true" size={18} />
          </button>
        </span>
      ) : <span className={page.muted}>{outcome(request)}</span>,
    },
  ];

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <section className={page.group} aria-label="Resumo">
        <p className={page.muted}>Aprove ou rejeite os pedidos de recuperação de senha da equipe. Ao aprovar, um link de acesso único vai por WhatsApp para quem pediu.</p>
        <div className={page.stats}>
          <StatCard label="Pendentes" value={counts.requested} sublabel="aguardando análise" sparklineData={trends.pending} sparklineColor="var(--warning)" animated />
          <StatCard label="Aprovadas" value={counts.approved} sublabel="link enviado ao membro" sparklineData={trends.resolved} sparklineColor="var(--chart-2)" animated animationDelay={0.06} />
          <StatCard label="Rejeitadas" value={counts.rejected} sublabel="solicitações recusadas" sparklineData={trends.all} sparklineColor="var(--danger)" animated animationDelay={0.12} />
        </div>
      </section>

      <section className={page.group} aria-labelledby="recuperacoes-lista">
        <h2 id="recuperacoes-lista" className={page.sectionTitle}>Solicitações recebidas</h2>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} aria-label="Buscar solicitações" placeholder="Buscar por nome ou e-mail" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        <LiteFilterChips
          label="Status"
          scroll
          active={[status]}
          onToggle={(id) => setStatus(id as StatusFilter)}
          chips={[
            { id: "all", label: "Todas", count: counts.all },
            { id: "requested", label: "Pendentes", count: counts.requested },
            { id: "approved", label: "Aprovadas", count: counts.approved },
            { id: "rejected", label: "Rejeitadas", count: counts.rejected },
            { id: "completed", label: "Concluídas", count: counts.completed },
          ]}
        />
        <LiteResponsiveData
          caption="Solicitações de recuperação de senha"
          columns={columns}
          rows={pageRows}
          rowKey={(request) => request.id}
          empty={<p>{requests.length === 0 ? "Nenhuma solicitação de recuperação de senha até o momento." : "Nenhuma solicitação encontrada. Ajuste a busca ou o status."}</p>}
        />
        <LitePagination label="Páginas de solicitações" {...pagination} />
      </section>

      <LiteConfirmDialog
        open={rejecting !== null}
        title="Rejeitar solicitação"
        tone="danger"
        confirmLabel="Rejeitar solicitação"
        onCancel={() => { setRejecting(null); setReason(""); }}
        onConfirm={confirmReject}
        description={(
          <div className={form.field}>
            <span>Rejeitar o pedido de {rejecting?.userEmail}? A justificativa é opcional.</span>
            <label className={form.label} htmlFor="recuperacao-motivo">Justificativa (opcional)</label>
            <textarea id="recuperacao-motivo" className={form.textarea} rows={3} placeholder="Ex.: procurar o RH presencialmente" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
        )}
      />

      <LiteSidePanel open={details !== null} onOpenChange={(open) => { if (!open) setDetails(null); }} title="Detalhes da rejeição" description={details ? `${details.userName} (${details.userEmail})` : undefined}>
        {details ? (
          <div className={page.group}>
            <span className={page.cellSub}>Justificativa do diretor</span>
            <p className={styles.note}>{details.directorNotes ?? "Nenhuma justificativa fornecida."}</p>
            {details.reviewedAt ? <span className={page.cellSub}>Analisada em {formatLiteDate(details.reviewedAt, DATE_TIME)}</span> : null}
          </div>
        ) : null}
      </LiteSidePanel>
    </div>
  );
}
