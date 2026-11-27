"use client";

/**
 * Requalificar leads frios (Lite, 27/11/2026). Dentro da gaveta "Leads frios" da aba Filas: fila, os dois grupos em
 * abas (não respondeu / respondeu e ficou frio) no lugar de duas colunas que não cabiam, linhas em pílula com seleção
 * que vale entre páginas, ações num rodapé e a confirmação no estilo do Lite. Mesmo envio de antes.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSelect } from "@/components/lite/controls";
import { toast } from "@/components/ui/sonner";
import { requalifyColdLeadsAction } from "@/features/ai-qualification/cold-lead-requalification-actions";
import { cn } from "@/lib/utils";

import { PlConfirm, PlSegmented, pl } from "../plantao/_components/plantoes-1a1-kit";
import styles from "./cold-lead-requalification-panel.module.css";

type ColdReviewLead = { id: string; nome: string; createdAt: Date };
type QueueReview = { noResponse: ColdReviewLead[]; respondedStillCold: ColdReviewLead[] };
type Group = "noResponse" | "respondedStillCold";
const EMPTY_QUEUE_REVIEW: QueueReview = { noResponse: [], respondedStillCold: [] };
const clock = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" });
const dayClock = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Sao_Paulo" });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function ColdLeadRequalificationPanel({
  queues,
  leadsByQueue,
  since,
}: {
  queues: Array<{ id: string; name: string }>;
  leadsByQueue: Record<string, QueueReview>;
  since: Date;
}) {
  const router = useRouter();
  const [queueId, setQueueId] = useState(queues[0]?.id ?? "");
  const [group, setGroup] = useState<Group>("noResponse");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmationIds, setConfirmationIds] = useState<string[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: Array<{ leadId: string; name: string; reason: string }>; fallback?: { phoneSuffix: string; sent: number } | null } | null>(null);
  const queueReview = useMemo(() => leadsByQueue[queueId] ?? EMPTY_QUEUE_REVIEW, [leadsByQueue, queueId]);
  const eligibleIds = useMemo(() => [...queueReview.noResponse, ...queueReview.respondedStillCold].map((lead) => lead.id), [queueReview]);
  const groupLeads = queueReview[group];
  const groupIds = groupLeads.map((lead) => lead.id);
  const groupAllSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.includes(id));

  function toggle(leadId: string) {
    setSelectedIds((current) => current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]);
  }

  function toggleGroup() {
    setSelectedIds((current) => groupAllSelected ? current.filter((id) => !groupIds.includes(id)) : [...new Set([...current, ...groupIds])]);
  }

  async function submit(ids: string[]) {
    if (!queueId || !ids.length) return;
    setIsSubmitting(true);
    setResult(null);
    const response = await requalifyColdLeadsAction({ queueId, leadIds: ids });
    setIsSubmitting(false);
    setConfirmationIds(null);
    if (!response.success) {
      toast.error(response.error);
      return;
    }
    setResult({ sent: response.sent, skipped: response.skipped });
    setSelectedIds([]);
    toast.success(plural(response.sent, "lead requalificado", "leads requalificados"), { description: response.skipped.length ? `${plural(response.skipped.length, "pulado", "pulados")}.` : undefined });
    router.refresh();
  }

  if (!queues.length) return <p className={pl.emptyBox}>Crie uma fila ativa para revisar leads frios.</p>;

  return (
    <div className={cn(pl.gx, styles.panel)}>
      <p className={pl.small}>Leads frios recebidos no dia operacional da fila. A mensagem segue o canal oficial de qualificação.</p>

      <div className={styles.queue}>
        <LiteSelect
          label="Fila"
          value={queueId}
          options={queues.map((queue) => ({ value: queue.id, label: queue.name }))}
          onChange={(value) => { setQueueId(value); setSelectedIds([]); setResult(null); }}
          searchPlaceholder="Buscar fila"
        />
        <p className={cn(pl.small, pl.num)}>Dia operacional desde {dayClock.format(since).replace(",", " às")}.</p>
      </div>

      <PlSegmented<Group>
        label="Grupo de leads frios"
        value={group}
        onChange={setGroup}
        options={[
          { value: "noResponse", label: "Não responderam", sub: plural(queueReview.noResponse.length, "lead", "leads") },
          { value: "respondedStillCold", label: "Responderam e ficaram frios", sub: plural(queueReview.respondedStillCold.length, "lead", "leads") },
        ]}
      />

      {groupLeads.length ? (
        <div className={styles.group}>
          <label className={cn(pl.check, styles.selectAll)}>
            <input type="checkbox" className={pl.checkBox} checked={groupAllSelected} onChange={toggleGroup} />
            Selecionar todos deste grupo
          </label>
          <ColdLeadPage key={`${queueId}-${group}`} leads={groupLeads} selectedIds={selectedIds} onToggle={toggle} />
        </div>
      ) : <p className={pl.emptyBox}>Nenhum lead neste grupo hoje.</p>}

      {result ? (
        <div role="status" className={styles.result}>
          <p className={styles.resultTitle}>{plural(result.sent, "reenviado", "reenviados")}, {plural(result.skipped.length, "pulado", "pulados")}</p>
          {result.fallback?.sent ? <p className={pl.small}>{plural(result.fallback.sent, "enviado", "enviados")} pelo número final {result.fallback.phoneSuffix}: o número da conversa ainda não tem o modelo de lembrete aprovado.</p> : null}
          {result.skipped.length ? (
            <ul className={styles.skipped}>
              {result.skipped.map((item, index) => <li key={`${item.leadId}-${index}`}><span className={styles.skippedName}>{item.name}:</span> {item.reason}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={styles.foot}>
        <span className={cn(pl.small, pl.num, styles.footCount)}>
          {selectedIds.length ? plural(selectedIds.length, "selecionado", "selecionados") : "Nenhum selecionado"}
          {selectedIds.length ? <button type="button" className={styles.clear} onClick={() => setSelectedIds([])}>Limpar</button> : null}
        </span>
        <div className={styles.footActions}>
          <button type="button" className={cn(pl.pill, pl.pillQuiet)} disabled={!selectedIds.length || isSubmitting} onClick={() => setConfirmationIds(selectedIds)}>Requalificar selecionados</button>
          <button type="button" className={cn(pl.pill, pl.pillPrimary)} disabled={!eligibleIds.length || isSubmitting} onClick={() => setConfirmationIds(eligibleIds)}>Requalificar todos <span className={pl.num}>({eligibleIds.length})</span></button>
        </div>
      </div>

      <PlConfirm
        open={confirmationIds !== null}
        onOpenChange={(open) => { if (!open && !isSubmitting) setConfirmationIds(null); }}
        title="Confirmar requalificação"
        description={`O modelo oficial de qualificação vai para ${plural(confirmationIds?.length ?? 0, "lead", "leads")}. Leads com opt-out, número inválido, envio recente ou que saíram da fila são pulados.`}
        confirmLabel={isSubmitting ? "Enviando…" : "Confirmar envio"}
        cancelLabel="Voltar"
        pending={isSubmitting}
        onConfirm={() => { if (confirmationIds) void submit(confirmationIds); }}
      />
    </div>
  );
}

/** Um grupo de leads frios, 10 por página, com a seleção valendo entre as páginas. */
function ColdLeadPage({ leads, selectedIds, onToggle }: { leads: ColdReviewLead[]; selectedIds: string[]; onToggle: (leadId: string) => void }) {
  const { pageRows, pagination } = useLitePages(leads, 10);
  return (
    <div className={styles.list}>
      <ul className={pl.rows}>
        {pageRows.map((lead) => {
          const checked = selectedIds.includes(lead.id);
          return (
            <li key={lead.id}>
              <label className={cn(pl.checkRow, checked && styles.rowOn)}>
                <input type="checkbox" className={pl.checkBox} checked={checked} onChange={() => onToggle(lead.id)} aria-label={`Selecionar ${lead.nome || "lead sem nome"}`} />
                <span className={styles.name}>{lead.nome || "Lead sem nome"}</span>
                <time className={cn(pl.small, pl.num, styles.time)} dateTime={lead.createdAt.toISOString()}>{clock.format(lead.createdAt)}</time>
              </label>
            </li>
          );
        })}
      </ul>
      <LitePagination {...pagination} label="Páginas dos leads frios" />
    </div>
  );
}
