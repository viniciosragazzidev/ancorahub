export type PlantaoDailyReservation = {
  key: string;
  token: string;
  expiresAt: string;
  value: string;
};

export type PlantaoSendReceipt = { messageId: string };

type PlantaoDeliveryDependencies = {
  reserveDaily: () => Promise<PlantaoDailyReservation | null>;
  markDailySent: (reservation: PlantaoDailyReservation, messageId: string) => Promise<void>;
  releaseDaily: (reservation: PlantaoDailyReservation) => Promise<void>;
  send: (idempotencyKey: string) => Promise<PlantaoSendReceipt>;
  onSending: () => Promise<void>;
  onSent: (receipt: PlantaoSendReceipt) => Promise<void>;
  onSideEffectError: (effect: string, error: unknown) => void;
};

function localTimeKey(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return ["hour", "minute", "second"].map((type) => parts.find((part) => part.type === type)?.value ?? "00").join("");
}

export function plantaoReportManualIdempotencyKey(tenantId: string, day: string, now: Date) {
  return `plantao-report-manual:${tenantId}:${day}:${localTimeKey(now)}`;
}

export async function deliverPlantaoReport(input: {
  tenantId: string;
  day: string;
  now: Date;
  manual: boolean;
}, dependencies: PlantaoDeliveryDependencies) {
  let reservation: PlantaoDailyReservation | null = null;

  try {
    if (!input.manual) {
      reservation = await dependencies.reserveDaily();
      if (!reservation) return { state: "duplicate" as const, reason: "already_sent_today" as const };
    }

    const idempotencyKey = input.manual
      ? plantaoReportManualIdempotencyKey(input.tenantId, input.day, input.now)
      : `plantao-report:${input.tenantId}:${input.day}`;

    await dependencies.onSending();
    const receipt = await dependencies.send(idempotencyKey);
    if (reservation) {
      await dependencies.markDailySent(reservation, receipt.messageId)
        .catch((error) => dependencies.onSideEffectError("reservation_update_failed", error));
    }
    await dependencies.onSent(receipt)
      .catch((error) => dependencies.onSideEffectError("status_write_failed", error));

    return { state: "sent" as const, messageId: receipt.messageId };
  } catch (error) {
    if (reservation) {
      await dependencies.releaseDaily(reservation)
        .catch((releaseError) => dependencies.onSideEffectError("reservation_release_failed", releaseError));
    }
    return { state: "failed" as const, error };
  }
}
