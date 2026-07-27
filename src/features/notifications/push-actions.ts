"use server";

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import webpush from "web-push";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// Configure VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY ?? "";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:suporte@corretop.com.br",
    vapidPublicKey,
    vapidPrivateKey,
  );
}

type PushSubscriptionJSON = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function subscribeUserAction(input: unknown) {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: "Inscrição de push inválida." };
  }

  const sub = parsed.data satisfies PushSubscriptionJSON;
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const now = new Date();

  // Check if already subscribed with this endpoint
  const existing = await db
    .select({
      id: schema.pushSubscriptions.id,
      userId: schema.pushSubscriptions.userId,
      tenantId: schema.pushSubscriptions.tenantId,
    })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, sub.endpoint))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].userId !== context.userId || existing[0].tenantId !== context.tenantId) {
      return { success: false as const, error: "Esta inscrição pertence a outra conta." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.pushSubscriptions)
        .set({ p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: null, updatedAt: now })
        .where(eq(schema.pushSubscriptions.id, existing[0].id));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "push_subscription",
        entidadeId: existing[0].id, acao: "atualizou_notificacoes_push",
      });
    });
    return { success: true as const };
  }

  const subscriptionId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.pushSubscriptions).values({
      id: subscriptionId, userId: context.userId, tenantId: context.tenantId,
      endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
      userAgent: null, createdAt: now, updatedAt: now,
    });
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "push_subscription",
      entidadeId: subscriptionId, acao: "ativou_notificacoes_push",
    });
  });

  return { success: true as const };
}

export async function unsubscribeUserAction(input: unknown) {
  const parsed = z.string().url().safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Inscrição de push inválida." };

  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const subscriptions = await db
    .select({ id: schema.pushSubscriptions.id })
    .from(schema.pushSubscriptions)
    .where(and(
      eq(schema.pushSubscriptions.endpoint, parsed.data),
      eq(schema.pushSubscriptions.userId, context.userId),
      eq(schema.pushSubscriptions.tenantId, context.tenantId),
    ));

  if (subscriptions.length === 0) return { success: true as const };

  await db.transaction(async (tx) => {
    await tx.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, subscriptions[0].id));
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "push_subscription",
      entidadeId: subscriptions[0].id, acao: "desativou_notificacoes_push",
    });
  });

  return { success: true as const };
}

export async function sendTestNotificationAction(message: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const subscriptions = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, context.userId));

  if (subscriptions.length === 0) {
    return { success: false, error: "Nenhuma inscrição encontrada. Você precisa se inscrever primeiro." };
  }

  const results: Array<{ endpoint: string; sent: boolean; error?: string }> = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({
          title: "CorreTop CRM",
          body: message || "Notificação de teste do CorreTop CRM.",
          icon: "/logo_icon.jpg",
          badge: "/logo_icon.jpg",
          vibrate: [100, 50, 100],
          data: {
            url: "/",
            dateOfArrival: Date.now(),
          },
          tag: "corretop-test",
          renotify: false,
          requireInteraction: false,
          actions: [
            { action: "open", title: "Abrir" },
            { action: "close", title: "Fechar" },
          ],
        }),
      );
      results.push({ endpoint: sub.endpoint, sent: true });
    } catch (error) {
      const statusCode =
        error instanceof Error &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : undefined;
      // If subscription is invalid (410 Gone), remove it
      if (statusCode === 410) {
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id));
        results.push({ endpoint: sub.endpoint, sent: false, error: "Inscrição expirada, removida." });
      } else {
        results.push({
          endpoint: sub.endpoint,
          sent: false,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  return {
    success: sentCount > 0,
    sent: sentCount,
    total: subscriptions.length,
    results,
  };
}

export async function getSubscriptionStatusAction() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const subscriptions = await db
    .select({ id: schema.pushSubscriptions.id, endpoint: schema.pushSubscriptions.endpoint, userAgent: schema.pushSubscriptions.userAgent, createdAt: schema.pushSubscriptions.createdAt })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, context.userId));

  return {
    subscribed: subscriptions.length > 0,
    count: subscriptions.length,
    subscriptions,
  };
}
