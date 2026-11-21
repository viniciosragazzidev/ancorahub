"use client";

/**
 * Laboratório: Funil de recuperação (recuperação, fase 2). A tela real com números simulados no tamanho da linha
 * de base de produção (cerca de 120 recuperados por semana) e T2–T4 pulados por template não aprovado.
 */
import { RecoveryFunnelView } from "@/features/lead-recovery/components/recovery-funnel-view";
import { weekStartOf, type RecoveryFunnelData } from "@/features/lead-recovery/metrics-core";

export function labRecoveryFunnelData(now = new Date()): RecoveryFunnelData {
  const current = weekStartOf(now.toISOString());
  const recovered = [104, 118, 126, 112, 131, 122, 127, 41];
  return {
    periodText: "Últimos 7 dias",
    queueName: null,
    controlPct: 10,
    recoveryEnabled: false,
    touchesTableMissing: false,
    numbers: { entered: 1251, qualifying: 96, hot: 541, stoppedMidway: 212, neverReplied: 285, inFollowUp: 140, callQueue: 0, nurture: 0, recovered: 127, doNotContact: 19 },
    steps: [
      { step: "t1", label: "T1 · lembrete 20 min", sent: 284, skipped: 12, topSkipReason: "passou da hora", failed: 3, replied: 91, recovered: 58, costBrl: 10.79 },
      { step: "t2", label: "T2 · benefício (3 h)", sent: 31, skipped: 188, topSkipReason: "template não aprovado", failed: 0, replied: 4, recovered: 3, costBrl: 10.85 },
      { step: "t3", label: "T3 · oferta de ligação (dia seguinte)", sent: 16, skipped: 159, topSkipReason: "template não aprovado", failed: 0, replied: 2, recovered: 1, costBrl: 5.6 },
      { step: "t4", label: "T4 · despedida (D+3)", sent: 2, skipped: 143, topSkipReason: "template não aprovado", failed: 0, replied: 0, recovered: 0, costBrl: 0.7 },
      { step: "s1", label: "S1 · retoma a pergunta", sent: 133, skipped: 0, topSkipReason: null, failed: 2, replied: 59, recovered: 25, costBrl: 0 },
    ],
    weeks: recovered.map((value, index) => ({
      weekStart: new Date(new Date(current).getTime() - (7 - index) * 7 * 86_400_000).toISOString(),
      entered: Math.round(value * 5.4),
      recovered: Math.round(value * 0.9),
      enteredControl: Math.round(value * 0.6),
      recoveredControl: value - Math.round(value * 0.9),
    })),
    health: {
      sends: 466,
      optOuts: 7,
      limit131049: 3,
      templatesNotApproved: [
        { name: "anc_t2_beneficio", label: "Reengajamento: comparar operadoras", status: "MISSING" },
        { name: "anc_t3_ligacao", label: "Reengajamento: oferecer ligação", status: "PENDING" },
        { name: "anc_t4_despedida", label: "Despedida: encerrar ou continuar", status: "MISSING" },
      ],
    },
  };
}

export function RecoveryFunnelLab() {
  return (
    <main className="arc-venancor mx-auto flex max-w-6xl flex-col gap-ds-24 p-ds-24 font-ds-inter">
      <RecoveryFunnelView data={labRecoveryFunnelData()} />
    </main>
  );
}
