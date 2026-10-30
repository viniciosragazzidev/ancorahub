import "server-only";

import { and, eq, gt, gte, isNotNull, lte } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";
import { getDutyPhotoReviewers } from "./duty-presence";

/** A presencial photo waiting this long for approval gets a second notice to the approvers (30/10). */
export const DUTY_PHOTO_REMINDER_AFTER_MINUTES = 5;
const LOOKBACK_HOURS = 3;

/**
 * Second notice for a presencial photo still waiting for approval after 5 min (30/10): the broker
 * keeps the turn by the photo time, but receives no lead until approved. Once per photo and
 * approver. Runs in the reminders job; never throws.
 */
export async function remindPendingDutyPhotos(now = new Date()) {
  const result = { photos: 0, notified: 0 };
  try {
    const db = getDatabase();
    const rows = await db
      .select({
        id: schema.dutyPresenceConfirmations.id,
        tenantId: schema.dutyPresenceConfirmations.tenantId,
        scheduleId: schema.dutyPresenceConfirmations.scheduleId,
        photoTakenAt: schema.dutyPresenceConfirmations.photoTakenAt,
        brokerName: schema.user.name,
      })
      .from(schema.dutyPresenceConfirmations)
      .innerJoin(schema.user, eq(schema.user.id, schema.dutyPresenceConfirmations.brokerId))
      .where(and(
        eq(schema.dutyPresenceConfirmations.status, "pending"),
        isNotNull(schema.dutyPresenceConfirmations.photoStorageKey),
        lte(schema.dutyPresenceConfirmations.photoTakenAt, new Date(now.getTime() - DUTY_PHOTO_REMINDER_AFTER_MINUTES * 60_000)),
        gte(schema.dutyPresenceConfirmations.photoTakenAt, new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60_000)),
        gt(schema.dutyPresenceConfirmations.shiftEndsAt, now),
      ))
      .limit(100);
    result.photos = rows.length;
    for (const row of rows) {
      const { reviewerIds, scheduleName } = await getDutyPhotoReviewers(row.tenantId, row.scheduleId);
      const firstName = row.brokerName.split(/\s+/)[0] || "O corretor";
      const minutes = row.photoTakenAt ? Math.max(DUTY_PHOTO_REMINDER_AFTER_MINUTES, Math.round((now.getTime() - row.photoTakenAt.getTime()) / 60_000)) : DUTY_PHOTO_REMINDER_AFTER_MINUTES;
      const sent = await Promise.all(reviewerIds.map((recipientUserId) => publishNotification({
        capability: "duty_presence_photo",
        tenantId: row.tenantId,
        recipientUserId,
        type: "duty_presence_photo",
        title: `${firstName} espera a liberação há ${minutes} min`,
        message: `A foto do ${scheduleName ?? "plantão"} está esperando validação. Até a liberação, ${firstName} não recebe lead.`,
        pushTitle: "Foto do plantão esperando você",
        pushBody: `${firstName} espera a liberação há ${minutes} min no ${scheduleName ?? "plantão"}.`,
        url: `/leads/distribuicao/plantao/${row.scheduleId}`,
        tag: `duty-photo-${row.id}`,
        idempotencyKey: `duty-photo-reminder:${row.id}:${recipientUserId}`,
      }).catch(() => false)));
      result.notified += sent.filter(Boolean).length;
    }
  } catch (error) {
    console.error("[plantao] photo_reminder_failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
  }
  return result;
}
