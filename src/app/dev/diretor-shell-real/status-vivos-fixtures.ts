/**
 * Status vivos na moldura real (dev): `?tela=status-vivos&estado=normal|atencao|critico|vazio|zero`.
 * Os cartões saem das mesmas regras puras dos provedores (features/live-status/providers), com linhas sintéticas
 * relativas ao relógio do pedido: a contagem da tela anda de verdade. Nada aqui chega à produção.
 */
import { buildAiQualificationStatus } from "@/features/live-status/providers/ai-qualification";
import { buildColdLeadsStatus } from "@/features/live-status/providers/cold-leads";
import { buildColdReleaseStatus } from "@/features/live-status/providers/cold-release";
import { buildDistributionEngineSeal } from "@/features/live-status/providers/distribution-engine";
import { buildDutyStatus } from "@/features/live-status/providers/duty";
import { buildFirstContactStatus } from "@/features/live-status/providers/first-contact";
import { buildOffersStatus } from "@/features/live-status/providers/offers";
import { buildWaitingBrokerStatus } from "@/features/live-status/providers/waiting-broker";
import { buildWhatsAppQueueStatus } from "@/features/live-status/providers/whatsapp-queue";
import type { LiveStatus, LiveStatusPayload } from "@/features/live-status/types";

export type LiveStatusCase = "normal" | "atencao" | "critico" | "vazio" | "zero";
export const LIVE_STATUS_CASES: LiveStatusCase[] = ["normal", "atencao", "critico", "vazio", "zero"];

const director = { role: "director" as const, canOpenQualification: true };
const settings = { firstContactMinutes: 15, graceMinutes: 5 };

/** `now` é o relógio do pedido: a contagem anda de verdade na tela. Fora do horário comercial, primeiro contato mostra quando a cobrança volta. */
export function liveStatusCase(kind: LiveStatusCase, now = new Date()): LiveStatusPayload {
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  const seconds = (value: number) => new Date(now.getTime() + value * 1000);
  const beat = (agoMinutes: number) => ({ job: "distribution" as const, finishedAt: at(-agoMinutes).toISOString(), outcome: "ok" as const, durationMs: 840 });
  const whatsappBeat = (agoMinutes: number) => ({ job: "whatsapp" as const, finishedAt: at(-agoMinutes).toISOString(), outcome: "ok" as const, durationMs: 210 });
  const emptyQueue = { waiting: 0, held: 0, heldUntil: null, nextFreeAt: null, failedToday: 0, topErrorCode: null };

  if (kind === "vazio") {
    return {
      statuses: [
        buildColdLeadsStatus({ rows: [], now, scope: director, automaticEnabled: true, turboCovers: false }),
        buildAiQualificationStatus({ rows: [], timeoutMinutes: 15, now, scope: director }),
        buildWaitingBrokerStatus({ groups: [], now }),
        buildOffersStatus({ aggregate: { total: 0, firstExpiresAt: null, firstOfferedAt: null }, now, scope: director }),
        buildFirstContactStatus({ assignedAt: [], settings, now, scope: director }),
        buildDutyStatus({ rows: [], now, scope: director }),
        buildWhatsAppQueueStatus({ aggregate: emptyQueue, heartbeat: whatsappBeat(0.5), now, scope: director }),
      ],
      seals: [buildDistributionEngineSeal({ heartbeat: beat(0.7), failedJobs: 0, failedEffects: 0, now, scope: director })],
    };
  }

  const coldRows = [
    ...Array.from({ length: 12 }, (_, index) => ({ coldSince: at(-200 - index * 20), attempts: 1 })),
    ...Array.from({ length: 38 }, (_, index) => ({ coldSince: at(-164 - index * 2), attempts: 0 })),
  ];
  const cold = buildColdLeadsStatus({ rows: coldRows, now, scope: director, automaticEnabled: true, turboCovers: false });
  const release = buildColdReleaseStatus({
    queues: [{
      queueId: "q-frios", name: "Leads Frios", releasedEarlyToday: false,
      waitingCreatedAt: [
        ...Array.from({ length: 23 }, () => new Date(now.getTime() - 30 * 3_600_000)),
        ...Array.from({ length: 9 }, () => new Date(now.getTime() - 2 * 3_600_000)),
      ],
    }],
    now, scope: director,
  });
  const ai = buildAiQualificationStatus({ rows: Array.from({ length: 8 }, (_, index) => ({ lastActivityAt: at(-11 + index) })), timeoutMinutes: 15, now, scope: director });
  const waiting = buildWaitingBrokerStatus({
    groups: kind === "normal"
      ? [{ reason: null, total: 2, nextRunAfter: at(1) }]
      : [{ reason: "Nenhum corretor de plantão nesta fila.", total: 6, nextRunAfter: at(1.2) }, { reason: "A fila está em modo manual", total: 20, nextRunAfter: at(9) }],
    now,
  });
  const offers = buildOffersStatus({
    aggregate: kind === "zero"
      ? { total: 3, firstExpiresAt: seconds(4), firstOfferedAt: at(-4.9) }
      : { total: 3, firstExpiresAt: at(2.68), firstOfferedAt: at(-2.3) },
    now, scope: director,
  });
  const firstContact = buildFirstContactStatus({
    assignedAt: kind === "normal" ? [at(-14), at(-3)] : [at(-14), at(-3), at(-40), at(-55)],
    settings, now, scope: director,
  });
  const dutyStart = at(-8);
  const dutyEnd = at(133);
  const duty = buildDutyStatus({
    rows: [
      ...Array.from({ length: 5 }, () => ({ status: "confirmed", shiftStartsAt: dutyStart, shiftEndsAt: dutyEnd })),
      ...Array.from({ length: kind === "normal" ? 0 : 2 }, () => ({ status: "pending", shiftStartsAt: kind === "critico" ? at(-40) : dutyStart, shiftEndsAt: dutyEnd })),
      { status: "confirmed", shiftStartsAt: at(180), shiftEndsAt: at(420) },
    ],
    now, scope: director,
  });
  const whatsapp = buildWhatsAppQueueStatus({
    aggregate: kind === "normal"
      ? { ...emptyQueue, waiting: 4, nextFreeAt: seconds(20) }
      : { waiting: 14, held: 9, heldUntil: at(37), nextFreeAt: seconds(20), failedToday: 2, topErrorCode: "131026" },
    heartbeat: whatsappBeat(kind === "critico" ? 9 : 0.4),
    now, scope: director,
  });
  const seal = buildDistributionEngineSeal({
    heartbeat: beat(kind === "critico" ? 9 : 0.7),
    failedJobs: kind === "atencao" ? 2 : 0,
    failedEffects: 0,
    now, scope: director,
  });
  const statuses: LiveStatus[] = [cold, ...(release ? [release] : []), ai, waiting, offers, firstContact, duty, whatsapp];
  return { statuses, seals: [seal] };
}
