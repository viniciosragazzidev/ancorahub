"use client";

/**
 * Detalhe da venda no visual Lite do diretor. Mesmos dados, mesmos números (com as tendências do cronograma) e as
 * mesmas ações (ver lead, ver cliente, marcar parcela paga e reverter pela mesma Server Action). Abas: cronograma,
 * dados do contrato e observações.
 *
 * Feedback (FEEDBACK.md, nível 1): marcar paga e reverter mostram o envio no botão e confirmam na própria parcela depois
 * do servidor; a falha mostra a causa, o que continua valendo e "Tentar de novo". Sem toast.
 */
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, FileText, Undo2, Users } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import page from "@/components/lite/page/lite-page.module.css";
import { LiteSuccess } from "@/components/lite/motion/success";
import { actionErrorMessage, normalizeActionError } from "@/lib/feedback/action-error";
import { useFeedback } from "@/lib/feedback/use-feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { markCommissionPaidAction, markCommissionUnpaidAction, type SaleActionState } from "@/features/sales/actions";
import { formatLiteDate } from "@/components/lite/format/date";
import { formatCurrency } from "@/features/quotes/utils";

import type { ScheduleItem } from "./commission-schedule-table";
import styles from "./sale-detail-lite.module.css";

type SaleLite = {
  id: string;
  leadId: string;
  leadName: string;
  clientName: string | null;
  brokerName: string | null;
  branchName: string | null;
  planName: string | null;
  carrierName: string | null;
  ruleName: string | null;
  status: string;
  saleDate: string;
  saleValue: number;
  notes: string | null;
};

const scheduleStatus: Record<string, { label: string; tone?: "success" | "warning" }> = {
  paid: { label: "Pago", tone: "success" },
  cancelled: { label: "Cancelado" },
};

export function SaleDetailLite({ sale, schedule, canManage }: { sale: SaleLite; schedule: ScheduleItem[]; canManage: boolean }) {
  const totalCommissions = schedule.reduce((sum, item) => sum + Number(item.amount), 0);
  const paidCommissions = schedule.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount), 0);
  const pendingCommissions = schedule.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount), 0);
  const paidPercentage = totalCommissions > 0 ? Math.round((paidCommissions / totalCommissions) * 100) : 0;
  const paidCount = schedule.filter((item) => item.status === "paid").length;
  const pendingCount = schedule.filter((item) => item.status === "pending").length;
  const ordered = [...schedule].sort((a, b) => a.monthNumber - b.monthNumber);
  const scheduleTrend = ordered.map((item) => Number(item.amount));
  const pendingTrend = ordered.map((item) => (item.status === "pending" ? Number(item.amount) : 0));
  let accumulated = 0;
  const paidTrend = ordered.map((item) => {
    if (item.status === "paid") accumulated += Number(item.amount);
    return accumulated;
  });

  const columns: LiteColumn<ScheduleItem>[] = [
    { id: "parcel", label: "Parcela", primary: true, render: (item) => <span className={page.cellTitle}>{item.monthNumber}º mês</span> },
    { id: "ref", label: "Mês de referência", secondary: true, render: (item) => <span className={page.numeric}>{item.referenceMonth}</span> },
    { id: "due", label: "Vencimento", render: (item) => <span className={page.numeric}>{formatLiteDate(item.dueDate)}</span> },
    { id: "pct", label: "Percentual", numeric: true, render: (item) => <span className={page.numeric}>{item.percentage}%</span> },
    { id: "amount", label: "Valor", numeric: true, render: (item) => <span className={page.numeric}>{formatCurrency(item.amount)}</span> },
    {
      id: "status",
      label: "Status",
      render: (item) => {
        const status = scheduleStatus[item.status] ?? { label: "A pagar", tone: "warning" as const };
        return <span className={page.badge} data-tone={status.tone}>{status.label}</span>;
      },
    },
    {
      id: "payment",
      label: "Pagamento",
      render: (item) => item.status === "paid"
        ? <span title={`Pago por ${item.paidByName ?? "Diretoria"} em ${formatLiteDate(item.paidAt)}`}>{item.paidByName ? item.paidByName.split(" ")[0] : "Confirmado"} em {formatLiteDate(item.paidAt)}</span>
        : <span className={page.muted}>{item.status === "cancelled" ? "Cancelado" : "Pendente"}</span>,
    },
  ];
  if (canManage) columns.push({ id: "actions", label: "Ações", numeric: true, render: (item) => <ScheduleAction item={item} /> });

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <section className={styles.identity} aria-labelledby="venda-titulo">
        <div className={styles.identityMain}>
          <p className={styles.code}>Venda {sale.id.slice(0, 8)}</p>
          <div className={styles.nameRow}>
            <h2 id="venda-titulo" className={styles.name}>{sale.leadName}</h2>
            <span className={page.badge} data-tone={sale.status === "active" ? "success" : undefined}>{sale.status === "active" ? "Ativa" : "Cancelada"}</span>
          </div>
          <p className={styles.meta}>
            <span>Registrada em {formatLiteDate(sale.saleDate)}</span>
            {sale.branchName ? <span>{sale.branchName}</span> : null}
          </p>
        </div>
        <div className={styles.actions}>
          <Link href={`/leads/${sale.leadId}`} className={page.button}><FileText aria-hidden="true" size={16} />Ver lead</Link>
          {sale.clientName ? <Link href="/clientes" className={page.button}><Users aria-hidden="true" size={16} />Ver cliente</Link> : null}
          <Link href="/vendas" className={page.button}><ArrowLeft aria-hidden="true" size={16} />Voltar para vendas</Link>
        </div>
      </section>

      <div className={page.group}>
        <div className={page.stats}>
          <StatCard label="Valor da venda" value={formatCurrency(sale.saleValue)} sparklineData={scheduleTrend} sparklineColor="var(--chart-1)" animated />
          <StatCard label="Total em comissões" value={formatCurrency(totalCommissions)} sparklineData={scheduleTrend} sparklineColor="var(--chart-2)" animated animationDelay={0.06} />
          <StatCard label="Comissão paga" value={formatCurrency(paidCommissions)} sparklineData={paidTrend} sparklineColor="var(--chart-3)" animated animationDelay={0.12} />
          <StatCard label="Comissão a pagar" value={formatCurrency(pendingCommissions)} sparklineData={pendingTrend} sparklineColor="var(--chart-4)" animated animationDelay={0.18} />
        </div>
        {totalCommissions > 0 ? (
          <div className={styles.progress} role="group" aria-label="Progresso do repasse de comissões">
            <div className={styles.progressHead}>
              <span>Progresso do repasse de comissões</span>
              <span className={page.numeric}>{paidPercentage}% concluído</span>
            </div>
            <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercentage} aria-label="Repasse concluído">
              <span className={styles.fill} style={{ width: `${paidPercentage}%` }} />
            </div>
            <div className={styles.progressFoot}>
              <span>{paidCount} de {schedule.length} parcelas liberadas</span>
              <span>{pendingCount} parcelas restantes</span>
            </div>
          </div>
        ) : null}
      </div>

      <Tabs defaultValue="schedule" variant="segment" className={styles.tabs}>
        <div className={styles.tabsRow}>
          <div className={styles.tabList}>
            <TabsList aria-label="Detalhes da venda" className="w-max">
              <TabsTrigger value="schedule">Cronograma de repasse<span className={styles.tabCount}>{schedule.length}</span></TabsTrigger>
              <TabsTrigger value="info">Dados do contrato</TabsTrigger>
              {sale.notes ? <TabsTrigger value="notes">Observações</TabsTrigger> : null}
            </TabsList>
          </div>
          <p className={styles.tabSummary}>{paidCount} pagas · {pendingCount} pendentes</p>
        </div>

        <TabsContent value="schedule" className={styles.panel}>
          <section className={page.card} aria-labelledby="cronograma">
            <header className={page.cardHead}>
              <h3 id="cronograma" className={page.cardTitle}>Cronograma de repasse de comissão</h3>
              <p className={page.cardDescription}>Parcelas calculadas e vinculadas às regras ativas da corretora. {schedule.length} parcelas registradas.</p>
            </header>
            {schedule.length === 0 ? (
              <div className={page.empty}>
                <h4 className={page.emptyTitle}>Nenhuma parcela gerada</h4>
                <p className={page.emptyText}>O cronograma de repasse é gerado sozinho com base na regra de comissionamento desta venda.</p>
              </div>
            ) : (
              <LiteResponsiveData caption="Parcelas da comissão" columns={columns} rows={schedule} rowKey={(item) => item.id} empty={<p>Nenhuma parcela.</p>} />
            )}
          </section>
        </TabsContent>

        <TabsContent value="info" className={styles.panel}>
          <div className={styles.pair}>
            <InfoCard title="Envolvidos na venda" description="Clientes e responsáveis">
              <Field label="Lead de origem">{sale.leadName}</Field>
              <Field label="Cliente cadastrado">{sale.clientName ?? "Não associado"}</Field>
              <Field label="Corretor responsável">{sale.brokerName ?? "Sem corretor"}</Field>
              <Field label="Unidade">{sale.branchName ?? "Sem unidade"}</Field>
            </InfoCard>
            <InfoCard title="Produto e comissionamento" description="Regras e especificações do produto vendido">
              <Field label="Plano">{sale.planName ? `${sale.planName}${sale.carrierName ? ` (${sale.carrierName})` : ""}` : "Não informado"}</Field>
              <Field label="Operadora">{sale.carrierName ?? "Não informada"}</Field>
              <Field label="Regra de comissão">{sale.ruleName ?? "Padrão (100% parcela única)"}</Field>
              <Field label="Status do contrato"><span className={page.badge} data-tone={sale.status === "active" ? "success" : undefined}>{sale.status === "active" ? "Ativo" : "Cancelado"}</span></Field>
            </InfoCard>
          </div>
        </TabsContent>

        {sale.notes ? (
          <TabsContent value="notes" className={styles.panel}>
            <section className={page.card} aria-labelledby="observacoes">
              <h3 id="observacoes" className={page.cardTitle}>Observações e anotações</h3>
              <p className={styles.notes}>{sale.notes}</p>
            </section>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function InfoCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className={page.card}>
      <header className={page.cardHead}>
        <h3 className={page.cardTitle}>{title}</h3>
        <p className={page.cardDescription}>{description}</p>
      </header>
      <dl className={styles.fields}>{children}</dl>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Marcar paga e reverter: as mesmas Server Actions; o resultado aparece na própria parcela, num efeito, não no render. */
function ScheduleAction({ item }: { item: ScheduleItem }) {
  const fire = useFeedback();
  const [payState, payAction, payPending] = useActionState<SaleActionState, FormData>(markCommissionPaidAction, {});
  const [unpayState, unpayAction, unpayPending] = useActionState<SaleActionState, FormData>(markCommissionUnpaidAction, {});
  const [note, setNote] = useState<{ kind: "done"; label: string } | { kind: "error"; message: string; retry: () => void } | null>(null);
  const payForm = useRef<HTMLFormElement>(null);
  const unpayForm = useRef<HTMLFormElement>(null);
  // Cada resposta do servidor é tratada uma vez (o efeito pode rodar de novo sem resposta nova).
  const handled = useRef<{ pay: SaleActionState; unpay: SaleActionState }>({ pay: payState, unpay: unpayState });
  useEffect(() => {
    if (handled.current.pay === payState) return;
    handled.current.pay = payState;
    if (payState.success) {
      fire("confirm");
      setNote({ kind: "done", label: "Paga" });
    }
    if (payState.error) {
      fire("error");
      setNote({ kind: "error", message: actionErrorMessage(normalizeActionError(payState.error, "Não deu para marcar a parcela como paga."), "A parcela continua pendente."), retry: () => payForm.current?.requestSubmit() });
    }
  }, [payState, fire]);
  useEffect(() => {
    if (handled.current.unpay === unpayState) return;
    handled.current.unpay = unpayState;
    if (unpayState.success) {
      fire("confirm");
      setNote({ kind: "done", label: "Pagamento revertido" });
    }
    if (unpayState.error) {
      fire("error");
      setNote({ kind: "error", message: actionErrorMessage(normalizeActionError(unpayState.error, "Não deu para reverter o pagamento."), "A parcela continua paga."), retry: () => unpayForm.current?.requestSubmit() });
    }
  }, [unpayState, fire]);
  const spinner = <span aria-hidden="true" className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />;
  const feedback = note?.kind === "done" ? <LiteSuccess label={note.label} className="text-sm text-[var(--success)]" />
    : note?.kind === "error" ? (
      <span className="flex flex-wrap items-center gap-2">
        <span role="alert" className="text-sm text-[var(--danger)]">{note.message}</span>
        <button type="button" className={page.button} onClick={note.retry}>Tentar de novo</button>
      </span>
    ) : null;
  if (item.status === "pending") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <form ref={payForm} action={(data) => { setNote(null); fire("tap"); payAction(data); }}>
          <input type="hidden" name="scheduleId" value={item.id} />
          <button type="submit" className={page.button} disabled={payPending} aria-busy={payPending || undefined}>
            {payPending ? <>{spinner}Salvando…</> : <><CheckCircle2 aria-hidden="true" size={16} />Marcar paga</>}
          </button>
        </form>
        {payPending ? null : feedback}
      </span>
    );
  }
  if (item.status === "paid") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <form ref={unpayForm} action={(data) => { setNote(null); fire("tap"); unpayAction(data); }}>
          <input type="hidden" name="scheduleId" value={item.id} />
          <button type="submit" className={page.button} disabled={unpayPending} aria-busy={unpayPending || undefined}>
            {unpayPending ? <>{spinner}Revertendo…</> : <><Undo2 aria-hidden="true" size={16} />Reverter</>}
          </button>
        </form>
        {unpayPending ? null : feedback}
      </span>
    );
  }
  return null;
}
