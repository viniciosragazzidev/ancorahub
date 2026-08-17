import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, eq, isNull, or } from "drizzle-orm";
import webpush from "web-push";

import { createLeadOffersForBrokers } from "@/features/lead-distribution/offers";
import { getDatabase, schema } from "@/shared/db";
import { runWithConcurrency } from "@/shared/async/run-with-concurrency";
import { isNotificationCapabilityEnabled } from "./queries";
import { publishRealtimeSync } from "./realtime-sync";
import type { NotificationCapabilityId } from "./catalog";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails("mailto:suporte@corretop.com.br", vapidPublicKey, vapidPrivateKey);
}

// ─── Coalescing & Aggregation Tracker ──────────────────────────────────────────

export const PUSH_COALESCE_WINDOW_MS = 60 * 1000; // 60 seconds window
export const MAX_INDIVIDUAL_PUSHES_IN_WINDOW = 2;

type UserPushHistory = {
  lastSentAt: number;
  countInWindow: number;
};

const userPushTracker = new Map<string, UserPushHistory>();

export function clearPushTrackerForTest() {
  userPushTracker.clear();
}

/**
 * Sends WebPush notification to all registered subscriptions of a user.
 * Implements server-side debouncing, coalescing and summary aggregation to avoid PWA device freezes.
 */
export async function sendNotificationToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  const db = getDatabase();
  const [membership] = await db
    .select({ availabilityStatus: schema.tenantMemberships.availabilityStatus })
    .from(schema.tenantMemberships)
    .where(eq(schema.tenantMemberships.userId, userId))
    .limit(1);

  if (membership?.availabilityStatus === "offline") {
    console.log(`[push-notification] User ${userId} is offline. Skipping push.`);
    return;
  }

  const now = Date.now();
  const history = userPushTracker.get(userId);

  let shouldAggregate = false;
  let currentWindowCount = 1;

  if (history && now - history.lastSentAt < PUSH_COALESCE_WINDOW_MS) {
    currentWindowCount = history.countInWindow + 1;
    if (currentWindowCount > MAX_INDIVIDUAL_PUSHES_IN_WINDOW) {
      shouldAggregate = true;
    }
  }

  userPushTracker.set(userId, {
    lastSentAt: now,
    countInWindow: currentWindowCount,
  });

  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));

  if (!subscriptions.length) return;

  let finalTitle = payload.title;
  let finalBody = payload.body;
  let finalTag = payload.tag ?? "corretop-notification";
  let renotify = false;
  let requireInteraction = false;

  if (shouldAggregate) {
    // Query unread count for user
    const [unreadResult] = await db
      .select({ value: count() })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.recipientUserId, userId), isNull(schema.notifications.readAt)));

    const unreadTotal = unreadResult?.value ?? currentWindowCount;

    finalTitle = `Você possui ${unreadTotal} novas notificações`;
    finalBody = `Você tem ${currentWindowCount} novas atualizações acumuladas no CorreTop. Clique para visualizar.`;
    finalTag = `corretop-summary-${userId}`;
    renotify = false;
    requireInteraction = false;
  }

  await runWithConcurrency(subscriptions, 5, async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: finalTitle,
          body: finalBody,
          icon: "/logo_icon.jpg",
          badge: "/logo_icon.jpg",
          vibrate: [100, 50, 100],
          data: { url: payload.url ?? "/", dateOfArrival: Date.now() },
          tag: finalTag,
          renotify,
          requireInteraction,
          actions: [{ action: "open", title: "Abrir" }, { action: "close", title: "Fechar" }],
        })
      );
    } catch (error) {
      const statusCode =
        typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;
      if (statusCode === 410) {
        await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id));
      }
    }
  });
}

export async function publishNotification(input: {
  capability: NotificationCapabilityId;
  tenantId: string;
  recipientUserId: string;
  leadId?: string | null;
  type: string;
  title: string;
  message: string;
  pushTitle?: string;
  pushBody?: string;
  url?: string;
  tag?: string;
  idempotencyKey?: string;
}) {
  if (!(await isNotificationCapabilityEnabled(input.capability))) return false;
  const inserted = await getDatabase().insert(schema.notifications).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    recipientUserId: input.recipientUserId,
    leadId: input.leadId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    idempotencyKey: input.idempotencyKey ?? null,
    createdAt: new Date(),
  }).onConflictDoNothing().returning({ id: schema.notifications.id });
  if (!inserted.length) return true;

  const notificationId = inserted[0].id;
  const occurredAt = new Date().toISOString();
  const [pushResult, realtimeResult] = await Promise.allSettled([
    sendNotificationToUser(input.recipientUserId, {
      title: input.pushTitle ?? input.title,
      body: input.pushBody ?? input.message,
      url: input.url,
      tag: input.tag,
    }),
    publishRealtimeSync(
      { tenantId: input.tenantId, userId: input.recipientUserId },
      { version: 1, kind: "notification.created", notificationId, occurredAt },
    ),
  ]);

  if (pushResult.status === "rejected") {
    throw pushResult.reason;
  }
  if (realtimeResult.status === "rejected") {
    console.warn("[notification-realtime] Signal delivery failed.");
  }
  return true;
}

export async function notifyNewLead(
  leadId: string,
  tenantId: string,
  branchId: string | null,
  corretorId: string | null,
  leadName: string,
  idempotencyPrefix?: string,
): Promise<{ notificationError?: string } | void> {
  let whatsappError: string | undefined;
  let pushError: string | undefined;

  if (corretorId) {
    try {
      await createLeadOffersForBrokers({
        tenantId,
        leadId,
        brokerIds: [corretorId],
        requestedBy: null,
      });
    } catch (err) {
      whatsappError = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[notifyNewLead] WhatsApp lead offer error:", err);
    }
  }

  try {
    if (!(await isNotificationCapabilityEnabled("lead_assignment"))) {
      if (whatsappError) return { notificationError: `WhatsApp: ${whatsappError}` };
      return;
    }
  } catch (err) {
    pushError = err instanceof Error ? err.message : "Erro ao verificar capabilities";
    console.error("[notifyNewLead] Capability check error:", err);
  }

  if (!pushError) {
    try {
      const db = getDatabase();
      const [leadInfo] = await db
        .select({
          qualificationState: schema.leads.qualificationState,
          qualificationStatus: schema.leads.qualificationStatus,
        })
        .from(schema.leads)
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId)))
        .limit(1);

      const isQualifiedByAi =
        leadInfo?.qualificationState === "QUALIFIED" ||
        ["waiting_human", "qualified", "hot", "warm"].includes(leadInfo?.qualificationStatus ?? "");

      const recipients = await db
        .select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role })
        .from(schema.tenantMemberships)
        .where(
          and(
            eq(schema.tenantMemberships.tenantId, tenantId),
            eq(schema.tenantMemberships.status, "active"),
            or(
              eq(schema.tenantMemberships.role, "director"),
              branchId
                ? and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, branchId))
                : eq(schema.tenantMemberships.role, "manager")
            )
          )
        );

      const targets = [
        ...(corretorId ? [{ userId: corretorId, role: "broker" as const }] : []),
        ...recipients.filter((recipient) => recipient.userId !== corretorId),
      ];

      await Promise.all(
        targets.map((target) => {
          const isDirector = target.role === "director";
          const isBroker = target.role === "broker";
          return publishNotification({
            capability: "lead_assignment",
            tenantId,
            recipientUserId: target.userId,
            leadId,
            type: "agent.lead_assigned",
            title: isBroker
              ? isQualifiedByAi ? "Lead qualificado atribuído" : "Novo lead atribuído"
              : isDirector
              ? isQualifiedByAi ? "Lead qualificado na corretora" : "Novo lead na corretora"
              : isQualifiedByAi ? "Lead qualificado na unidade" : "Novo lead na unidade",
            message: isBroker
              ? isQualifiedByAi ? `Você recebeu o lead qualificado ${leadName} para atender.` : `Você recebeu o lead ${leadName} para atender.`
              : corretorId
              ? isQualifiedByAi ? `"${leadName}" foi qualificado pela IA e distribuído.` : `"${leadName}" chegou e foi distribuído.`
              : isQualifiedByAi ? `"${leadName}" foi qualificado pela IA e aguarda atendimento.` : `"${leadName}" chegou e está aguardando distribuição.`,
            pushTitle: isBroker
              ? isQualifiedByAi ? "Lead Qualificado Atribuído! ⚡" : "Novo Lead Atribuído! ⚡"
              : isDirector
              ? isQualifiedByAi ? "Lead Qualificado na Corretora! ✨" : "Novo Lead na Corretora! 🏢"
              : isQualifiedByAi ? "Lead Qualificado na Unidade! ✨" : "Novo Lead na Unidade! 📍",
            pushBody: isBroker
              ? isQualifiedByAi ? `O lead "${leadName}" foi qualificado pela IA e distribuído para você.` : `O lead "${leadName}" foi distribuído para você.`
              : corretorId
              ? isQualifiedByAi ? `"${leadName}" foi qualificado pela IA e distribuído.` : `"${leadName}" chegou e foi distribuído.`
              : isQualifiedByAi ? `"${leadName}" foi qualificado pela IA e aguarda atendimento.` : `"${leadName}" está aguardando distribuição.`,
            url: `/leads/${leadId}`,
            tag: "corretop-leads",
            idempotencyKey: idempotencyPrefix ? `${idempotencyPrefix}:${target.userId}` : undefined,
          });
        })
      );
    } catch (err) {
      pushError = err instanceof Error ? err.message : "Erro ao enviar push notifications";
      console.error("[notifyNewLead] Push notification error:", err);
    }
  }

  const errors: string[] = [];
  if (whatsappError) errors.push(`WhatsApp: ${whatsappError}`);
  if (pushError) errors.push(`Push: ${pushError}`);
  if (errors.length) return { notificationError: errors.join("; ") };
}

/**
 * Notify managers and directors about a new lead arrival (pre-distribution).
 */
export async function notifyLeadArrived(leadId: string, tenantId: string, branchId: string | null, leadName: string, idempotencyPrefix?: string) {
  if (!(await isNotificationCapabilityEnabled("lead_arrived"))) return;

  const recipients = await getDatabase()
    .select({ userId: schema.tenantMemberships.userId, role: schema.tenantMemberships.role })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        eq(schema.tenantMemberships.status, "active"),
        or(
          eq(schema.tenantMemberships.role, "director"),
          branchId
            ? and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, branchId))
            : eq(schema.tenantMemberships.role, "manager")
        )
      )
    );

  await Promise.all(
    recipients.map((recipient) =>
      publishNotification({
        capability: "lead_arrived",
        tenantId,
        recipientUserId: recipient.userId,
        leadId,
        type: "lead_arrived",
        title: recipient.role === "director" ? "Novo lead na corretora" : "Novo lead na unidade",
        message: `"${leadName}" chegou e ${
          recipient.role === "director" ? "está disponível na corretora" : "está disponível na unidade"
        }.`,
        pushTitle: "Novo Lead Chegou! 📥",
        pushBody: `"${leadName}" acabou de chegar no sistema.`,
        url: `/leads/${leadId}`,
        tag: "corretop-leads",
        idempotencyKey: idempotencyPrefix ? `${idempotencyPrefix}:${recipient.userId}` : undefined,
      })
    )
  );
}

/**
 * Notify the previous broker when a lead is reassigned.
 */
export async function notifyLeadReassigned(leadId: string, tenantId: string, previousOwnerId: string, leadName: string) {
  if (!(await isNotificationCapabilityEnabled("lead_reassigned"))) return;

  await publishNotification({
    capability: "lead_reassigned",
    tenantId,
    recipientUserId: previousOwnerId,
    leadId,
    type: "lead_reassigned",
    title: "Lead reatribuído",
    message: `O lead ${leadName} foi reatribuído a outro corretor e não está mais sob sua responsabilidade.`,
    pushTitle: "Lead Reatribuído 🔄",
    pushBody: `${leadName} foi reatribuído para outro profissional.`,
    url: `/leads/${leadId}`,
    tag: "corretop-leads",
  });
}
