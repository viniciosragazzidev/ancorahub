"use client";

/**
 * Fila de ligação "Sem resposta" por unidade (plano §6, fase 4), no funil de recuperação. Fixo: unidade, quantos,
 * há quanto tempo e quantos são perfil A. A ação em lote ("Mandar segurados frios para a fila") mora no menu ⋯,
 * só para o diretor; é nível 1 do FEEDBACK.md (confirma depois do servidor, falha com "Tentar de novo").
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

import { LiteMenu } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { ActionNoticeLine, useActionNotice } from "@/components/lite/feedback/action-notice";
import page from "@/components/lite/page/lite-page.module.css";
import { useDevLab } from "@/lib/dev-lab";

import { moveHeldColdToCallQueueAction } from "../actions";
import type { RecoveryFunnelData } from "../metrics-core";

type QueueRow = NonNullable<RecoveryFunnelData["callQueue"]>[number];
const n = (value: number) => value.toLocaleString("pt-BR");

function age(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 dia" : `${days} dias`;
}

const columns: LiteColumn<QueueRow>[] = [
  { id: "branch", label: "Unidade", primary: true, render: (row) => row.branch },
  { id: "total", label: "Na fila", numeric: true, render: (row) => n(row.total) },
  { id: "age", label: "Tempo médio na fila", numeric: true, render: (row) => age(row.avgHours) },
  { id: "a", label: "Perfil A", numeric: true, secondary: true, render: (row) => n(row.profileA) },
];

export function CallQueuePanel({ rows, heldCold, enabled, canEdit }: { rows: QueueRow[]; heldCold: number; enabled: boolean; canEdit: boolean }) {
  const router = useRouter();
  const lab = useDevLab();
  const notice = useActionNotice();
  const [held, setHeld] = useState(heldCold);
  const [extra, setExtra] = useState(0);
  const total = rows.reduce((sum, row) => sum + row.total, 0) + extra;
  const move = async () => {
    notice.tap();
    const result = await (lab?.recoveryCallQueue?.moveHeld ?? moveHeldColdToCallQueueAction)().catch(() => ({ ok: false as const, error: "Sem conexão agora." }));
    if (!result.ok) { notice.fail(result.error, { keeps: "Os leads continuam como estavam.", retry: () => void move() }); return; }
    setHeld((value) => Math.max(0, value - result.moved));
    setExtra((value) => value + result.moved);
    notice.succeed(result.moved ? `${n(result.moved)} frios segurados entraram na fila de ligação.` : "Nenhum frio segurado para mandar agora.");
    if (!lab) router.refresh();
  };
  return (
    <section className={page.group} aria-labelledby="call-queue-title">
      <header className={page.cardHead}>
        <h2 id="call-queue-title" className={page.cardTitle}>Fila de ligação ({n(total)})</h2>
        <p className={page.cardDescription}>
          Quem terminou os lembretes sem responder. O Call Âncora liga para esta fila primeiro, pela pontuação (A4 antes de D1).
          {enabled ? "" : " A fila está desligada: ligue em Qualificação turbo › Configurar recuperação para o Call Âncora usar a ordem da fila."}
        </p>
      </header>
      {canEdit ? (
        <div className={page.toolbar}>
          <span className={page.cardDescription} style={{ flex: "1 1 220px" }}>{n(held)} frios segurados sem dono podem entrar na fila.</span>
          <span className={page.toolbarEnd}>
            <LiteMenu label="Ações da fila de ligação" items={[{ id: "move", label: `Mandar ${n(Math.min(held, 300))} segurados frios para a fila`, onSelect: () => void move(), disabled: held === 0 }]} />
          </span>
        </div>
      ) : null}
      <ActionNoticeLine notice={notice.notice} />
      <LiteResponsiveData caption="Fila de ligação por unidade" columns={columns} rows={rows} rowKey={(row) => row.branchId ?? row.branch} empty={<p className={page.emptyText}>Ninguém na fila de ligação.</p>} />
    </section>
  );
}
