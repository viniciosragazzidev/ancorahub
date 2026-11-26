import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, or } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getNoticeRecipients } from "@/features/leads/closing-director-alert";
import { lastFourDigits } from "@/features/internal-contacts/decision";
import { getDatabase, schema } from "@/shared/db";

import type { TeamNotice } from "./catalog";
import {
  describeNoticeDelivery,
  MAX_NOTICE_TESTS_PER_HOUR,
  NOTICE_DELIVERY_LIMIT,
  NOTICE_DELIVERY_WINDOW_DAYS,
  NOTICE_TEST_PREFIX,
  noticeDeliveryReason,
  noticeDeliverySituation,
  noticePurposes,
  remainingNoticeTests,
  type NoticeDeliverySituation,
  type NoticeDeliveryView,
} from "./deliveries";
import { PREVIEW_VARIABLES } from "./preview-variables";
import { getTeamNoticeSetting } from "./service";

const deliveryColumns = {
  id: schema.whatsappOutboundMessages.id,
  status: schema.whatsappOutboundMessages.status,
  deliveryRoute: schema.whatsappOutboundMessages.deliveryRoute,
  destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
  holdReason: schema.whatsappOutboundMessages.holdReason,
  providerErrorCode: schema.whatsappOutboundMessages.providerErrorCode,
  providerErrorMessage: schema.whatsappOutboundMessages.providerErrorMessage,
  idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey,
  createdAt: schema.whatsappOutboundMessages.createdAt,
  sentAt: schema.whatsappOutboundMessages.sentAt,
  failedAt: schema.whatsappOutboundMessages.failedAt,
  nextAttemptAt: schema.whatsappOutboundMessages.nextAttemptAt,
};

/** Últimos envios do aviso, só da empresa, dos últimos 30 dias. Todo aviso passa pela fila protegida. */
export async function listNoticeDeliveries(tenantId: string, notice: TeamNotice, now = new Date()): Promise<NoticeDeliveryView[]> {
  const since = new Date(now.getTime() - NOTICE_DELIVERY_WINDOW_DAYS * 24 * 3_600_000);
  const purposes = noticePurposes(notice);
  const rows = await getDatabase().select(deliveryColumns).from(schema.whatsappOutboundMessages)
    .where(and(
      eq(schema.whatsappOutboundMessages.tenantId, tenantId),
      eq(schema.whatsappOutboundMessages.recipientType, "user"),
      gte(schema.whatsappOutboundMessages.createdAt, since),
      notice.chat
        ? inArray(schema.whatsappOutboundMessages.purpose, purposes)
        : or(eq(schema.whatsappOutboundMessages.noticeKey, notice.key), inArray(schema.whatsappOutboundMessages.purpose, purposes)),
    ))
    .orderBy(desc(schema.whatsappOutboundMessages.createdAt))
    .limit(NOTICE_DELIVERY_LIMIT);
  return rows.map(describeNoticeDelivery);
}

function testAuditEntity(tenantId: string, notice: TeamNotice) {
  return `${tenantId}:${notice.key}`;
}

/** Testes deste aviso na última hora (cada clique conta uma vez, mesmo com vários números). */
export async function countNoticeTestsLastHour(tenantId: string, notice: TeamNotice, now = new Date()) {
  const rows = await getDatabase().select({ id: schema.auditLogs.id }).from(schema.auditLogs).where(and(
    eq(schema.auditLogs.entidade, "team_notice_test"),
    eq(schema.auditLogs.entidadeId, testAuditEntity(tenantId, notice)),
    gte(schema.auditLogs.createdAt, new Date(now.getTime() - 3_600_000)),
  ));
  return rows.length;
}

export type NoticeTestResult = { to: string; situation: NoticeDeliverySituation; reason: string };

export type NoticeTestOutcome =
  | { ok: true; results: NoticeTestResult[]; remaining: number }
  | { ok: false; error: string };

/**
 * Envia o aviso de verdade, pela mesma fila e pelo mesmo canal escolhido, com os valores de exemplo da prévia,
 * para os números próprios do aviso (ou, sem números próprios, para o celular de quem testa). No máximo 3 por hora.
 */
export async function sendNoticeTest(input: { tenantId: string; userId: string; notice: TeamNotice; now?: Date }): Promise<NoticeTestOutcome> {
  const { tenantId, userId, notice } = input;
  const now = input.now ?? new Date();
  const db = getDatabase();
  const setting = await getTeamNoticeSetting(tenantId, notice);
  if (!setting.enabled) return { ok: false, error: "O aviso está desligado. Ligue e salve para testar." };

  const used = await countNoticeTestsLastHour(tenantId, notice, now);
  if (used >= MAX_NOTICE_TESTS_PER_HOUR) return { ok: false, error: `Limite de ${MAX_NOTICE_TESTS_PER_HOUR} testes por hora deste aviso. Tente mais tarde.` };

  let phones: string[];
  if (notice.phoneRecipients) {
    phones = await getNoticeRecipients(tenantId, notice.key);
    if (!phones.length) return { ok: false, error: "O aviso não tem número que recebe. Salve pelo menos um número." };
  } else {
    const [own] = await db.select({ phone: schema.brokerProfiles.phone }).from(schema.brokerProfiles)
      .where(and(eq(schema.brokerProfiles.tenantId, tenantId), eq(schema.brokerProfiles.userId, userId))).limit(1);
    if (!own?.phone) return { ok: false, error: "Seu cadastro não tem celular. Cadastre o seu número para receber o teste." };
    phones = [own.phone];
  }

  const clickId = randomUUID();
  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId, entidade: "team_notice_test", entidadeId: testAuditEntity(tenantId, notice),
    acao: "team_notice.test_sent", metadata: { noticeKey: notice.key, recipients: phones.length },
  });

  const variables = PREVIEW_VARIABLES[notice.purpose] ?? [];
  const results: NoticeTestResult[] = [];
  for (const phone of phones) {
    const to = lastFourDigits(phone);
    try {
      const queued = await enqueueMetaTemplateMessage({
        tenantId, recipientType: "user", destinationPhone: phone, purpose: notice.purpose, variables,
        requestedBy: userId, idempotencyKey: `${NOTICE_TEST_PREFIX}${notice.key}:${clickId}:${phone.replace(/\D/g, "")}`,
      });
      if ((queued.status as string) !== "skipped") await processMetaOutboundBatch(1, tenantId, queued.id);
      const [row] = await db.select(deliveryColumns).from(schema.whatsappOutboundMessages)
        .where(and(eq(schema.whatsappOutboundMessages.id, queued.id), eq(schema.whatsappOutboundMessages.tenantId, tenantId))).limit(1);
      results.push(row
        ? { to, situation: noticeDeliverySituation(row.status), reason: noticeDeliveryReason(row) }
        : { to, situation: "not_sent", reason: "Não saiu, sem motivo registrado." });
    } catch (error) {
      results.push({ to, situation: "not_sent", reason: error instanceof Error ? error.message.slice(0, 160) : "Não deu para enviar." });
    }
  }
  return { ok: true, results, remaining: remainingNoticeTests(used + 1) };
}
