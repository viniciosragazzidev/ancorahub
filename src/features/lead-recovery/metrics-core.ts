/**
 * Funil de recuperação (plano §8.3), parte pura: recebe linhas por lead e por toque (sem dado pessoal) e monta os
 * quatro blocos da tela. A definição de "recuperado" mora aqui e é a mesma em todo lugar:
 *
 *   recuperado = lead de anúncio que ENTROU na recuperação (virou frio por tempo, recebeu lembrete do turbo,
 *   follow-up de silêncio ou toque da cadência) e DEPOIS respondeu e hoje está quente, morno ou com etapa de
 *   cotação em diante.
 */
import { isRecoveryControl } from "./settings-core";

export const RECOVERY_BASELINE_PER_WEEK = 120;
export const RECOVERY_TARGET_PER_WEEK = 240;

export type RecoveryLeadRow = {
  leadId: string;
  createdAt: string;
  qualificationStatus: string | null;
  status: string;
  hasBroker: boolean;
  replied: boolean;
  recoveryState: string | null;
  doNotContact: boolean;
  cadenceActive: boolean;
  /** Primeira entrada na recuperação; null = nunca entrou. */
  enteredAt: string | null;
  /** Respondeu depois de entrar na recuperação. */
  repliedAfterEntry: boolean;
};

export type RecoveryTouchRow = {
  leadId: string;
  step: string;
  status: string;
  reason: string | null;
  at: string;
  /** Cliente respondeu em até 24 h depois do toque. */
  replied: boolean;
  costBrl: number;
};

const HOT = new Set(["hot", "qualified"]);
const ADVANCED = new Set(["quote_sent", "negotiation", "documentation_pending", "under_analysis", "converted"]);

export function isRecovered(row: RecoveryLeadRow) {
  if (!row.enteredAt || !row.repliedAfterEntry) return false;
  return HOT.has(row.qualificationStatus ?? "") || row.qualificationStatus === "warm" || ADVANCED.has(row.status);
}

export type RecoveryNumbers = {
  entered: number;
  qualifying: number;
  hot: number;
  stoppedMidway: number;
  neverReplied: number;
  inFollowUp: number;
  callQueue: number;
  nurture: number;
  recovered: number;
  doNotContact: number;
};

export function recoveryNumbers(rows: readonly RecoveryLeadRow[]): RecoveryNumbers {
  const out: RecoveryNumbers = { entered: rows.length, qualifying: 0, hot: 0, stoppedMidway: 0, neverReplied: 0, inFollowUp: 0, callQueue: 0, nurture: 0, recovered: 0, doNotContact: 0 };
  for (const row of rows) {
    const qualification = row.qualificationStatus ?? "pending";
    if (row.doNotContact) { out.doNotContact += 1; continue; }
    if (isRecovered(row)) out.recovered += 1;
    if (HOT.has(qualification)) out.hot += 1;
    if (row.recoveryState === "call_queue") { out.callQueue += 1; continue; }
    if (row.recoveryState === "nurture" || row.recoveryState === "bad_moment") { out.nurture += 1; continue; }
    if (row.hasBroker || HOT.has(qualification) || qualification === "warm") continue;
    if (row.cadenceActive) out.inFollowUp += 1;
    if (qualification === "cold") {
      if (row.replied) out.stoppedMidway += 1;
      else out.neverReplied += 1;
    } else if (qualification === "pending" || qualification === "qualifying") out.qualifying += 1;
  }
  return out;
}

export const STEP_LABEL: Record<string, string> = {
  t1: "T1 · lembrete 20 min",
  t2: "T2 · benefício (3 h)",
  t3: "T3 · oferta de ligação (dia seguinte)",
  t4: "T4 · despedida (D+3)",
  s1: "S1 · retoma a pergunta",
  s2: "S2 · pergunta simples (+3 h)",
  s3: "S3 · simulação (+20 h)",
  s4: "S4 · lembrete da cotação (D+2)",
  s5: "S5 · oferta de ligação (D+4)",
  s6: "S6 · despedida (D+7)",
  w2: "Morno · ponte da IA (+2 h)",
  w3: "Morno · segundo toque",
  call: "Ligação (Call Âncora)",
  n1: "Nutrição · 1º mês",
  n2: "Nutrição · 2º mês",
  n3: "Nutrição · 3º mês",
};
const STEP_ORDER = Object.keys(STEP_LABEL);

export const SKIP_REASON_LABEL: Record<string, string> = {
  template_not_approved: "template não aprovado",
  marketing_blocked: "Marketing barrado (DEC-155)",
  stale: "passou da hora",
  held: "retido na fila de envio",
  "131049": "limite da Meta (131049)",
  outside_hours: "fora do horário",
  no_channel: "sem canal válido",
  control: "grupo de controle",
};

export type RecoveryStepRow = { step: string; label: string; sent: number; skipped: number; topSkipReason: string | null; failed: number; replied: number; recovered: number; costBrl: number };

export function recoverySteps(touches: readonly RecoveryTouchRow[], recoveredLeads: ReadonlySet<string>): RecoveryStepRow[] {
  const byStep = new Map<string, RecoveryTouchRow[]>();
  for (const touch of touches) byStep.set(touch.step, [...(byStep.get(touch.step) ?? []), touch]);
  return [...byStep.entries()]
    .sort(([a], [b]) => (STEP_ORDER.indexOf(a) === -1 ? 99 : STEP_ORDER.indexOf(a)) - (STEP_ORDER.indexOf(b) === -1 ? 99 : STEP_ORDER.indexOf(b)))
    .map(([step, rows]) => {
      const sent = rows.filter((row) => row.status === "sent");
      const skipped = rows.filter((row) => row.status === "skipped");
      const reasons = new Map<string, number>();
      for (const row of skipped) reasons.set(row.reason ?? "sem motivo", (reasons.get(row.reason ?? "sem motivo") ?? 0) + 1);
      const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        step,
        label: STEP_LABEL[step] ?? step,
        sent: sent.length,
        skipped: skipped.length,
        topSkipReason: top ? SKIP_REASON_LABEL[top] ?? top : null,
        failed: rows.filter((row) => row.status === "failed" || row.status === "held").length,
        replied: sent.filter((row) => row.replied).length,
        recovered: new Set(sent.filter((row) => recoveredLeads.has(row.leadId)).map((row) => row.leadId)).size,
        costBrl: Number(sent.reduce((sum, row) => sum + row.costBrl, 0).toFixed(2)),
      };
    });
}

export type RecoveryWeek = { weekStart: string; entered: number; recovered: number; enteredControl: number; recoveredControl: number };

/** Segunda-feira 00:00 (São Paulo, UTC−3) da semana do instante. */
export function weekStartOf(iso: string) {
  const date = new Date(new Date(iso).getTime() - 3 * 3_600_000);
  const day = (date.getUTCDay() + 6) % 7;
  const monday = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day);
  return new Date(monday + 3 * 3_600_000).toISOString();
}

/** Recuperados por semana de entrada na recuperação, com o grupo de controle separado (§9). */
export function recoveryWeeks(rows: readonly RecoveryLeadRow[], controlPct: number, weeks: number, now: Date): RecoveryWeek[] {
  const current = weekStartOf(now.toISOString());
  const starts = Array.from({ length: weeks }, (_, index) => new Date(new Date(current).getTime() - (weeks - 1 - index) * 7 * 86_400_000).toISOString());
  const map = new Map(starts.map((start) => [start, { weekStart: start, entered: 0, recovered: 0, enteredControl: 0, recoveredControl: 0 }]));
  for (const row of rows) {
    if (!row.enteredAt) continue;
    const week = map.get(weekStartOf(row.enteredAt));
    if (!week) continue;
    const control = isRecoveryControl(row.leadId, controlPct);
    const recovered = isRecovered(row);
    if (control) { week.enteredControl += 1; if (recovered) week.recoveredControl += 1; }
    else { week.entered += 1; if (recovered) week.recovered += 1; }
  }
  return starts.map((start) => map.get(start)!);
}

export type RecoveryHealth = {
  sends: number;
  optOuts: number;
  limit131049: number;
  templatesNotApproved: Array<{ name: string; label: string; status: string }>;
};

export type RecoveryFunnelData = {
  periodText: string;
  queueName: string | null;
  controlPct: number;
  recoveryEnabled: boolean;
  /** A tabela 0234 ainda não existe: só turbo e follow-up de silêncio entram. */
  touchesTableMissing: boolean;
  numbers: RecoveryNumbers;
  steps: RecoveryStepRow[];
  weeks: RecoveryWeek[];
  health: RecoveryHealth;
  /** Fila de ligação por unidade (fase 4). */
  callQueue?: Array<{ branch: string; branchId: string | null; total: number; avgHours: number | null; profileA: number }>;
  /** Frios segurados que podem ir para a fila em lote. */
  heldCold?: number;
  callQueueEnabled?: boolean;
};

/** Taxa em % com uma casa, ou null sem base. */
export function rate(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}
