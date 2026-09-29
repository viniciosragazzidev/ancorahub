import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lt, lte } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { enqueueMetaTextMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { phoneHash } from "@/features/waha-cadence/contract";

const GLOBAL_KILL_SWITCH = "feature_waha_cadence_enabled"; // Legacy switch retained until automation settings receive their own key.

/**
 * Scan all active automations for the tenant and enqueue leads/clients that match criteria.
 */
export async function scanAndEnqueueAutomations(tenantId: string) {
  const db = getDatabase();

  // Fetch published/active automations
  const automations = await db
    .select()
    .from(schema.crmAutomations)
    .where(
      and(
        eq(schema.crmAutomations.tenantId, tenantId),
        eq(schema.crmAutomations.status, "publicado")
      )
    );

  const now = new Date();

  for (const automation of automations) {
    const config = (automation.configuration || {}) as Record<string, unknown>;

    if (automation.triggerType === "lead_parado") {
      // Find leads in non-final stages that haven't been updated for N hours
      const hours = Number(config.hours || 24);
      const threshold = new Date(now.getTime() - hours * 60 * 60 * 1000);

      const targetLeads = await db
        .select()
        .from(schema.leads)
        .where(
          and(
            eq(schema.leads.tenantId, tenantId),
            inArray(schema.leads.status, ["new", "in_contact", "distributed", "negotiation", "quote_sent", "documentation_pending", "under_analysis"]),
            lt(schema.leads.updatedAt, threshold)
          )
        );

      for (const lead of targetLeads) {
        // Check if already enqueued/run
        const [existing] = await db
          .select()
          .from(schema.crmAutomationLogs)
          .where(
            and(
              eq(schema.crmAutomationLogs.automationId, automation.id),
              eq(schema.crmAutomationLogs.leadId, lead.id)
            )
          )
          .limit(1);

        if (!existing) {
          await db.insert(schema.crmAutomationLogs).values({
            id: randomUUID(),
            tenantId,
            automationId: automation.id,
            leadId: lead.id,
            status: "pending",
            runAfter: now,
          });
        }
      }
    }

    if (automation.triggerType === "proposta_sem_resposta") {
      // Find proposals that are "enviada" and valid_until is past
      const targetProposals = await db
        .select()
        .from(schema.proposals)
        .where(
          and(
            eq(schema.proposals.tenantId, tenantId),
            eq(schema.proposals.status, "enviada"),
            lt(schema.proposals.validUntil, now)
          )
        );

      for (const prop of targetProposals) {
        const [existing] = await db
          .select()
          .from(schema.crmAutomationLogs)
          .where(
            and(
              eq(schema.crmAutomationLogs.automationId, automation.id),
              eq(schema.crmAutomationLogs.leadId, prop.leadId)
            )
          )
          .limit(1);

        if (!existing) {
          await db.insert(schema.crmAutomationLogs).values({
            id: randomUUID(),
            tenantId,
            automationId: automation.id,
            leadId: prop.leadId,
            status: "pending",
            runAfter: now,
          });
        }
      }
    }

    if (automation.triggerType === "documento_pendente") {
      // Find leads with pending documents in checklist
      const pendingDocs = await db
        .select({ leadId: schema.leadDocumentChecklist.leadId })
        .from(schema.leadDocumentChecklist)
        .where(
          and(
            eq(schema.leadDocumentChecklist.tenantId, tenantId),
            eq(schema.leadDocumentChecklist.status, "pending")
          )
        );

      const targetLeadIds = Array.from(new Set(pendingDocs.map((d) => d.leadId)));

      for (const leadId of targetLeadIds) {
        const [existing] = await db
          .select()
          .from(schema.crmAutomationLogs)
          .where(
            and(
              eq(schema.crmAutomationLogs.automationId, automation.id),
              eq(schema.crmAutomationLogs.leadId, leadId)
            )
          )
          .limit(1);

        if (!existing) {
          await db.insert(schema.crmAutomationLogs).values({
            id: randomUUID(),
            tenantId,
            automationId: automation.id,
            leadId,
            status: "pending",
            runAfter: now,
          });
        }
      }
    }

    if (automation.triggerType === "retorno_agendado") {
      // Find leads with overdue tasks
      const overdueTasks = await db
        .select()
        .from(schema.leadTasks)
        .where(
          and(
            eq(schema.leadTasks.tenantId, tenantId),
            isNull(schema.leadTasks.completedAt),
            lt(schema.leadTasks.dueAt, now)
          )
        );

      for (const task of overdueTasks) {
        if (!task.leadId) continue;
        const [existing] = await db
          .select()
          .from(schema.crmAutomationLogs)
          .where(
            and(
              eq(schema.crmAutomationLogs.automationId, automation.id),
              eq(schema.crmAutomationLogs.leadId, task.leadId)
            )
          )
          .limit(1);

        if (!existing) {
          await db.insert(schema.crmAutomationLogs).values({
            id: randomUUID(),
            tenantId,
            automationId: automation.id,
            leadId: task.leadId,
            status: "pending",
            runAfter: now,
          });
        }
      }
    }
  }
}

/**
 * Triggers an instant automation for lead events (like 'lead_perdido', 'venda_realizada', 'alerta_primeiro_atendimento').
 */
export async function triggerInstantAutomation(tenantId: string, leadId: string, triggerType: string) {
  const db = getDatabase();

  // Find published automations with this trigger
  const automations = await db
    .select()
    .from(schema.crmAutomations)
    .where(
      and(
        eq(schema.crmAutomations.tenantId, tenantId),
        eq(schema.crmAutomations.status, "publicado"),
        eq(schema.crmAutomations.triggerType, triggerType)
      )
    );

  const now = new Date();

  for (const automation of automations) {
    const [existing] = await db
      .select()
      .from(schema.crmAutomationLogs)
      .where(
        and(
          eq(schema.crmAutomationLogs.automationId, automation.id),
          eq(schema.crmAutomationLogs.leadId, leadId)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(schema.crmAutomationLogs).values({
        id: randomUUID(),
        tenantId,
        automationId: automation.id,
        leadId,
        status: "pending",
        runAfter: now,
      });
    }
  }
}

/**
 * Periodically processes pending and retrying logs in the background.
 */
export async function runAutomationProcessor(limit = 20) {
  const isEnabled = (await getSystemSetting(GLOBAL_KILL_SWITCH)) === "true";
  if (!isEnabled) {
    return { processed: 0, failed: 0, skipped: 0, message: "Kill switch is active or WAHA is disabled." };
  }

  const db = getDatabase();
  const now = new Date();

  // Fetch pending/retrying logs due for execution
  const logs = await db
    .select()
    .from(schema.crmAutomationLogs)
    .where(
      and(
        inArray(schema.crmAutomationLogs.status, ["pending", "processing"]), // 'processing' is treated as retrying here if it got stuck
        lte(schema.crmAutomationLogs.runAfter, now)
      )
    )
    .limit(limit);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const log of logs) {
    try {
      // Mark as processing
      await db
        .update(schema.crmAutomationLogs)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(schema.crmAutomationLogs.id, log.id));

      // Fetch the automation
      const [automation] = await db
        .select()
        .from(schema.crmAutomations)
        .where(eq(schema.crmAutomations.id, log.automationId))
        .limit(1);

      if (!automation) {
        await db
          .update(schema.crmAutomationLogs)
          .set({ status: "failed", lastError: "Automation config deleted", updatedAt: new Date() })
          .where(eq(schema.crmAutomationLogs.id, log.id));
        skipped++;
        continue;
      }

      // Fetch recipient details (only lead for now)
      if (!log.leadId) {
        await db
          .update(schema.crmAutomationLogs)
          .set({ status: "failed", lastError: "No leadId defined in execution log", updatedAt: new Date() })
          .where(eq(schema.crmAutomationLogs.id, log.id));
        skipped++;
        continue;
      }

      const [lead] = await db
        .select()
        .from(schema.leads)
        .where(and(eq(schema.leads.id, log.leadId), eq(schema.leads.tenantId, log.tenantId)))
        .limit(1);

      if (!lead || !lead.telefone) {
        await db
          .update(schema.crmAutomationLogs)
          .set({ status: "failed", lastError: "Lead or phone not found", updatedAt: new Date() })
          .where(eq(schema.crmAutomationLogs.id, log.id));
        skipped++;
        continue;
      }

      // Check opt-out suppressions
      const phoneHashValue = phoneHash(lead.telefone);
      const [suppression] = await db
        .select()
        .from(schema.wahaSuppressions)
        .where(eq(schema.wahaSuppressions.phoneHash, phoneHashValue))
        .limit(1);

      if (suppression) {
        await db
          .update(schema.crmAutomationLogs)
          .set({ status: "completed", lastError: "Contato opt-out/suprimido", updatedAt: new Date() })
          .where(eq(schema.crmAutomationLogs.id, log.id));
        skipped++;
        continue;
      }

      // Format template body with lead name
      const body = automation.templateBody.replace(/\{\{\s*nome\s*\}\}/gi, lead.nome);

      const queued = await enqueueMetaTextMessage({
        tenantId: log.tenantId,
        recipientType: "lead",
        recipientId: lead.id,
        destinationPhone: lead.telefone,
        body,
        idempotencyKey: `automation:${log.id}`,
      });
      const delivery = await processMetaOutboundBatch(1, log.tenantId, queued.id);
      if (delivery.sent !== 1) throw new Error("Mensagem oficial ainda aguarda processamento pela Meta.");

      // Mark execution as completed
      await db
        .update(schema.crmAutomationLogs)
        .set({
          status: "completed",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.crmAutomationLogs.id, log.id));

      processed++;
    } catch (error) {
      const lastError = error instanceof Error ? error.message : "Erro desconhecido";
      const newAttempts = log.attemptCount + 1;
      const isDeadLetter = newAttempts >= log.maxAttempts;

      // Exponential backoff retry: 60s * 2^attempts
      const waitSeconds = 60 * Math.pow(2, log.attemptCount);
      const nextRun = new Date(now.getTime() + waitSeconds * 1000);

      await db
        .update(schema.crmAutomationLogs)
        .set({
          status: isDeadLetter ? "dead_letter" : "pending",
          attemptCount: newAttempts,
          lastError: lastError.slice(0, 200),
          runAfter: isDeadLetter ? now : nextRun,
          updatedAt: new Date(),
        })
        .where(eq(schema.crmAutomationLogs.id, log.id));

      failed++;
    }
  }

  return { processed, failed, skipped };
}
