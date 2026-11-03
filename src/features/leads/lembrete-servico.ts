import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

const spDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const spDay = (date: Date) => spDayFormat.format(date);

const brasilOffset = -3 * 60; // America/Sao Paulo UTC offset in minutes

export type EntradaLembrete = {
  leadId: string;
  /** Preset ("today", "tomorrow", "in_2_days", "in_3_days") or an ISO date string. */
  when: string;
  /** Rescheduling: the open return this one replaces (closed in the same transaction). */
  replaceTaskId?: string;
};

/**
 * Converte o preset (ou a data escolhida) no prazo do retorno, no fuso de São Paulo.
 * Lança Error com a mensagem para o usuário quando a data é inválida ou já passou.
 */
export function resolverQuandoLembrete(when: string, agora: Date): Date {
  let dueAt: Date;
  switch (when) {
    case "today": {
      // Today at 18:00 BRT
      dueAt = new Date(agora.getTime() + brasilOffset * 60 * 1000);
      dueAt.setUTCHours(21, 0, 0, 0); // 18:00 BRT = 21:00 UTC
      break;
    }
    case "tomorrow": {
      // Tomorrow at 09:00 BRT
      dueAt = new Date(agora.getTime() + 24 * 60 * 60 * 1000 + brasilOffset * 60 * 1000);
      dueAt.setUTCHours(12, 0, 0, 0); // 09:00 BRT = 12:00 UTC
      break;
    }
    case "in_2_days":
    case "in_3_days": {
      const days = when === "in_2_days" ? 2 : 3;
      dueAt = new Date(agora.getTime() + days * 24 * 60 * 60 * 1000 + brasilOffset * 60 * 1000);
      dueAt.setUTCHours(12, 0, 0, 0); // 09:00 BRT = 12:00 UTC
      break;
    }
    default: {
      // Custom ISO date
      const escolhida = new Date(when);
      if (Number.isNaN(escolhida.getTime())) throw new Error("Data invalida.");
      if (spDay(escolhida) < spDay(agora)) throw new Error("Essa data já passou. Escolha outra.");
      dueAt = escolhida;
      break;
    }
  }
  // A return marked for a time of today that already passed (e.g. today picked in the
  // afternoon, which means 09:00) would be born overdue: it moves to 1h from now.
  if (dueAt.getTime() <= agora.getTime()) dueAt = new Date(agora.getTime() + 60 * 60_000);
  return dueAt;
}

/** Cria o retorno (lembrete) do lead. Lança Error com a mensagem para o usuário. */
export async function criarLembreteDoLead(context: TenantContext, entrada: EntradaLembrete, agora = new Date()) {
  const db = getDatabase();
  const [lead] = await db
    .select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, entrada.leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);
  if (!lead) throw new Error("Lead nao encontrado.");
  if (context.role === "broker" && lead.corretorId !== context.userId) throw new Error("Voce so pode criar lembretes nos seus leads.");
  if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) throw new Error("Este lead nao pertence a sua filial.");

  const dueAt = resolverQuandoLembrete(entrada.when, agora);
  const title = spDay(dueAt) === spDay(agora) ? "Retornar contato hoje" : "Retornar contato";
  const taskId = randomUUID();

  await db.transaction(async (tx) => {
    if (entrada.replaceTaskId) {
      // Same lead, still open, and (for a broker) their own: otherwise nothing is closed.
      const fechadas = await tx.update(schema.leadTasks).set({ completedAt: new Date() }).where(and(
        eq(schema.leadTasks.id, entrada.replaceTaskId),
        eq(schema.leadTasks.tenantId, context.tenantId),
        eq(schema.leadTasks.leadId, lead.id),
        isNull(schema.leadTasks.completedAt),
        ...(context.role === "broker" ? [eq(schema.leadTasks.assignedTo, context.userId)] : []),
      )).returning({ id: schema.leadTasks.id });
      if (fechadas.length) {
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_task", entidadeId: entrada.replaceTaskId, acao: "reagendou" });
      }
    }
    await tx.insert(schema.leadTasks).values({
      id: taskId,
      tenantId: context.tenantId,
      leadId: lead.id,
      assignedTo: lead.corretorId ?? context.userId,
      createdBy: context.userId,
      title,
      description: `Lembrete de retorno agendado para ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(dueAt)}.`,
      priority: "normal",
      dueAt,
    });
    await tx.insert(schema.leadTaskAssignees).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      taskId,
      userId: lead.corretorId ?? context.userId,
    });
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead_task",
      entidadeId: taskId,
      acao: "criou_lembrete_retorno",
    });
  });
  return { taskId, dueAt };
}
