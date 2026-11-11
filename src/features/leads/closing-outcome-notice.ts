import "server-only";

import { and, eq } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";

import {
  calendarDaysBetween,
  classifyClosingOutcome,
  closingOutcomeNotice,
  closingOutcomeNotificationKey,
  isPersonActor,
  leavesClosingStage,
} from "./closing-outcome-core";

/**
 * Desfecho do fechamento (09/11): avisa cada diretor no app quando uma pessoa tira o lead de Documentação ou
 * Em análise (fechou, perdeu ou voltou de etapa). Regra, sistema e IA nunca avisam. Uma notificação por diretor
 * e por saída. Nunca lança erro: a mudança de etapa já está salva.
 *
 * WhatsApp: o aviso "Fechamento para a direção" é um template com variáveis fixas de entrada no fechamento
 * (cliente, telefone, negócio, corretor, etapa, resumo). Reaproveitá-lo para o desfecho mandaria um texto errado,
 * e um aviso novo exige template aprovado. Por isso o desfecho sai só no app.
 * A venda em si (IA ou registro) vai para esses números em `notifyDirectorsSale` (11/11), com título de venda
 * no número da empresa; no template da Meta (alternativa) a etapa aparece como "Venda ...".
 */
export async function notifyDirectorsClosingOutcome(input: {
  tenantId: string;
  leadId: string;
  previousStatus: string | null;
  newStatus: string;
  actorType: string;
  actorUserId: string | null;
  changedAt: Date;
  /** Quando o lead entrou na etapa que deixou (para os dias no fechamento). */
  previousStageEnteredAt: Date | null;
  lossCode?: string | null;
  /** Valor aprovado da venda, quando a saída é a venda registrada. */
  saleValue?: string | number | null;
}) {
  if (!isPersonActor(input.actorType) || !leavesClosingStage(input.previousStatus, input.newStatus)) return { notified: 0 };
  try {
    const db = getDatabase();
    const [lead] = await db
      .select({ nome: schema.leads.nome, monthlyValue: schema.leads.monthlyValue, brokerName: schema.user.name })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1);
    if (!lead) return { notified: 0 };
    const directors = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, input.tenantId),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.tenantMemberships.role, "director"),
      ))
      .groupBy(schema.tenantMemberships.userId)
      .limit(20);
    if (!directors.length) return { notified: 0 };
    const outcome = classifyClosingOutcome({ toStatus: input.newStatus, lossCode: input.lossCode ?? null });
    const notice = closingOutcomeNotice({
      leadName: lead.nome,
      brokerName: lead.brokerName,
      outcome,
      value: input.saleValue ?? lead.monthlyValue,
      daysInClosing: input.previousStageEnteredAt ? calendarDaysBetween(input.previousStageEnteredAt, input.changedAt) : null,
    });
    const settled = await Promise.allSettled(directors.map((director) => publishNotification({
      capability: "lead_closing_outcome",
      tenantId: input.tenantId,
      recipientUserId: director.userId,
      leadId: input.leadId,
      type: "lead_closing_outcome",
      ...notice,
      url: `/leads/${input.leadId}`,
      tag: `lead-${input.leadId}`,
      idempotencyKey: closingOutcomeNotificationKey({ leadId: input.leadId, changedAt: input.changedAt, recipientUserId: director.userId }),
    })));
    let notified = 0;
    for (const item of settled) {
      if (item.status === "fulfilled" && item.value) notified += 1;
      if (item.status === "rejected") console.warn("[closing-outcome] notice_failed", { leadId: input.leadId, error: item.reason instanceof Error ? item.reason.message.slice(0, 200) : "unknown" });
    }
    return { notified };
  } catch (error) {
    console.error("[closing-outcome] failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { notified: 0 };
  }
}
