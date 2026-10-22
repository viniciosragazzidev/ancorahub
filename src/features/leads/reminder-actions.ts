"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type ReminderState = { success?: boolean; error?: string };

const spDayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
const spDay = (date: Date) => spDayFormat.format(date);

const reminderInput = z.object({
  leadId: z.string().min(1),
  /** Preset key or an ISO date string */
  when: z.string().min(1),
  /** Rescheduling: the open return this one replaces (closed in the same transaction). */
  replaceTaskId: z.string().uuid().optional(),
});

export async function quickReminderAction(
  _previous: ReminderState,
  formData: FormData,
): Promise<ReminderState> {
  const parsed = reminderInput.safeParse({
    leadId: formData.get("leadId"),
    when: formData.get("when"),
    replaceTaskId: formData.get("replaceTaskId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [lead] = await db
      .select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead) return { error: "Lead nao encontrado." };
    if (context.role === "broker" && lead.corretorId !== context.userId) {
      return { error: "Voce so pode criar lembretes nos seus leads." };
    }
    if (context.role === "manager" && (!context.branchId || lead.branchId !== context.branchId)) {
      return { error: "Este lead nao pertence a sua filial." };
    }

    // Resolve dueAt from "when" value
    const now = new Date();
    let dueAt: Date;
    const brasilOffset = -3 * 60; // America/Sao Paulo UTC offset in minutes

    switch (parsed.data.when) {
      case "today": {
        // Today at 18:00 BRT
        dueAt = new Date(now.getTime() + brasilOffset * 60 * 1000);
        dueAt.setUTCHours(21, 0, 0, 0); // 18:00 BRT = 21:00 UTC
        break;
      }
      case "tomorrow": {
        // Tomorrow at 09:00 BRT
        dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000 + brasilOffset * 60 * 1000);
        dueAt.setUTCHours(12, 0, 0, 0); // 09:00 BRT = 12:00 UTC
        break;
      }
      case "in_2_days":
      case "in_3_days": {
        const days = parsed.data.when === "in_2_days" ? 2 : 3;
        dueAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000 + brasilOffset * 60 * 1000);
        dueAt.setUTCHours(12, 0, 0, 0); // 09:00 BRT = 12:00 UTC
        break;
      }
      default: {
        // Custom ISO date
        const parsedDate = new Date(parsed.data.when);
        if (Number.isNaN(parsedDate.getTime())) return { error: "Data invalida." };
        if (spDay(parsedDate) < spDay(now)) return { error: "Essa data já passou. Escolha outra." };
        dueAt = parsedDate;
        break;
      }
    }
    // A return marked for a time of today that already passed (e.g. today picked in the
    // afternoon, which means 09:00) would be born overdue: it moves to 1h from now.
    if (dueAt.getTime() <= now.getTime()) dueAt = new Date(now.getTime() + 60 * 60_000);

    const title = spDay(dueAt) === spDay(now) ? "Retornar contato hoje" : "Retornar contato";
    const taskId = randomUUID();

    await db.transaction(async (tx) => {
      if (parsed.data.replaceTaskId) {
        // Same lead, still open, and (for a broker) their own: otherwise nothing is closed.
        const closed = await tx.update(schema.leadTasks).set({ completedAt: new Date() }).where(and(
          eq(schema.leadTasks.id, parsed.data.replaceTaskId),
          eq(schema.leadTasks.tenantId, context.tenantId),
          eq(schema.leadTasks.leadId, lead.id),
          isNull(schema.leadTasks.completedAt),
          ...(context.role === "broker" ? [eq(schema.leadTasks.assignedTo, context.userId)] : []),
        )).returning({ id: schema.leadTasks.id });
        if (closed.length) {
          await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_task", entidadeId: parsed.data.replaceTaskId, acao: "reagendou" });
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

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Nao foi possivel criar o lembrete.",
    };
  }
}
