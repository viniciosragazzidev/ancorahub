import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { wakeLeadsAwaitingEligibleBroker } from "@/features/lead-distribution/jobs";
import { eq } from "drizzle-orm";

import { confirmOwnDutyPresence, getDutyPhotoReviewers, resolveOwnDutyOccurrence, SELF_CONFIRM_LATE_MESSAGE } from "@/features/lead-distribution/duty-presence";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";
import { cleanPresencePhoto, isAllowedImage } from "@/features/lead-distribution/presence-photo";
import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { uploadR2Object } from "@/shared/storage/r2-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const assignmentSchema = z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/**
 * The broker confirms his presence in the plantão from the app (multipart:
 * assignmentId + photo when presencial). A POST, so "Ver como" never confirms
 * for the broker. Presencial: the photo goes to R2 and releases the broker.
 */
export async function POST(request: Request) {
  const context = await getRequiredTenantContext().catch(() => null);
  if (!context) return fail("Sem sessão.", 401);
  if (context.role !== "broker") return fail("Só o corretor confirma a própria presença.", 403);
  const form = await request.formData().catch(() => null);
  const assignmentId = assignmentSchema.safeParse(form?.get("assignmentId"));
  if (!form || !assignmentId.success) return fail("Plantão inválido.", 400);

  const resolved = await resolveOwnDutyOccurrence({ tenantId: context.tenantId, brokerId: context.userId, assignmentId: assignmentId.data });
  if (!resolved.ok) {
    if (resolved.reason === "late") return fail(SELF_CONFIRM_LATE_MESSAGE, 409);
    if (resolved.reason === "absent") return fail("A gestão marcou falta neste plantão. Fale com ela.", 409);
    return fail(resolved.reason === "outside_window" ? "A confirmação abre 30 minutos antes do plantão e vale até o fim dele." : "Não achei esse plantão na sua escala.", resolved.reason === "outside_window" ? 409 : 404);
  }
  const { occurrence } = resolved;

  let photoStorageKey: string | null = null;
  if (occurrence.mode === "presencial") {
    const photo = form.get("photo");
    if (!(photo instanceof File) || photo.size === 0) return fail("Tire a foto do local para confirmar.", 400);
    if (photo.size > MAX_PHOTO_BYTES) return fail("A foto passou de 8 MB. Tire outra.", 413);
    const raw = Buffer.from(await photo.arrayBuffer());
    if (!isAllowedImage(raw)) return fail("Envie uma foto em JPG, PNG ou WebP.", 415);
    if (!(await isR2StorageEnabled())) return fail("O envio de fotos está desligado agora. Fale com a gestão.", 503);
    const clean = await cleanPresencePhoto(raw).catch(() => null);
    if (!clean) return fail("Não consegui ler essa foto. Tire outra.", 415);
    photoStorageKey = `duty-presence/${context.tenantId}/${context.userId}/${occurrence.window.dutyDate}-${randomUUID()}.jpg`;
    try {
      await uploadR2Object(photoStorageKey, clean, "image/jpeg");
    } catch (error) {
      console.error("[duty-presence] photo upload failed", error);
      return fail("Não consegui enviar a foto. Confira a internet e tente de novo.", 502);
    }
  }

  try {
    const result = await confirmOwnDutyPresence({ tenantId: context.tenantId, brokerId: context.userId, occurrence, photoStorageKey });
    if (!result.ok) {
      if (result.reason === "late") return fail(SELF_CONFIRM_LATE_MESSAGE, 409);
      if (result.reason === "outside_window") return fail("A confirmação abre 30 minutos antes do plantão e vale até o fim dele.", 409);
      if (result.reason === "absent") return fail("A gestão marcou falta neste plantão. Fale com ela.", 409);
      return fail("Tire a foto do local para confirmar.", 409);
    }
    if (result.awaitingRelease) {
      // Presencial: the broker stays paused; the director/manager validates the photo and releases him.
      void notifyPhotoReviewers({ tenantId: context.tenantId, brokerId: context.userId, scheduleId: occurrence.scheduleId, confirmationId: result.confirmationId }).catch(() => undefined);
    } else {
      // Confirmed brokers can receive leads from now on: retry those waiting.
      await wakeLeadsAwaitingEligibleBroker(context.tenantId).catch(() => 0);
    }
    return NextResponse.json({ ok: true, mode: occurrence.mode, awaitingRelease: result.awaitingRelease }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[duty-presence] self confirm failed", error);
    return fail("Não consegui confirmar agora. Tente de novo em alguns segundos.", 500);
  }
}

async function notifyPhotoReviewers(input: { tenantId: string; brokerId: string; scheduleId: string; confirmationId: string }) {
  const [{ reviewerIds, scheduleName }, [broker]] = await Promise.all([
    getDutyPhotoReviewers(input.tenantId, input.scheduleId),
    getDatabase().select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, input.brokerId)).limit(1),
  ]);
  const firstName = broker?.name.split(/\s+/)[0] ?? "O corretor";
  await Promise.all(reviewerIds.map((recipientUserId) => publishNotification({
    capability: "duty_presence_photo",
    tenantId: input.tenantId,
    recipientUserId,
    type: "duty_presence_photo",
    title: `${firstName} enviou a foto do plantão presencial`,
    message: `Valide a foto e libere ${firstName} no ${scheduleName ?? "plantão"}. Até lá ele fica pausado.`,
    pushTitle: "Foto do plantão para validar",
    pushBody: `${firstName} está esperando você liberar no ${scheduleName ?? "plantão"}.`,
    url: `/leads/distribuicao/plantao/${input.scheduleId}`,
    tag: `duty-photo-${input.confirmationId}`,
    idempotencyKey: `duty-photo:${input.confirmationId}:${recipientUserId}`,
  }).catch(() => false)));
}
