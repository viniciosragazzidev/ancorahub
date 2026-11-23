import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { resolvePmeQueueFor } from "@/features/lead-distribution/pme-queue-routing";
import { isPmeQueueName } from "@/features/lead-distribution/pme-queue-matching";
import { authenticateLeadWebhook, WebhookAuthError } from "@/features/leads/webhooks/services/authenticate-lead-webhook";
import { createLeadFromWebhookSync } from "@/features/leads/webhooks/services/create-lead-from-webhook-sync";
import { getDatabase, schema } from "@/shared/db";

import { PUBLIC_FORM_CHANNEL_ID as PUBLIC_FORM_CHANNEL } from "./channel";
import { submissionToLeadData, type PublicFormSubmission } from "./form-flow";

export { PUBLIC_FORM_CHANNEL }; 

/**
 * Para onde vai o lead do /formulario (variáveis no Coolify):
 * - FORMULARIO_WEBHOOK_TOKEN: o token de uma fonte de captura (Configurações > Integrações). Dá a empresa,
 *   a unidade e quem aparece como autor da entrada, como numa landing page.
 * - FORMULARIO_FILA: id ou nome da fila de pessoa física (ex.: "FILA PF - RENAN"). Sem ela, o lead entra
 *   na unidade da fonte e segue a distribuição normal.
 * Empresa (CNPJ) entra direto na fila PME que corresponde à fila PF, como os leads do Meta.
 */
export function publicFormConfig() {
  const token = process.env.FORMULARIO_WEBHOOK_TOKEN?.trim();
  const queue = process.env.FORMULARIO_FILA?.trim() || null;
  return token ? { token, queue } : null;
}

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function resolveIntakeQueue(tenantId: string, configured: string | null, company: boolean) {
  const db = getDatabase();
  const active = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.status, "active")))
    .orderBy(asc(schema.leadQueues.createdAt));
  const base = configured ? active.find((queue) => queue.id === configured || fold(queue.name) === fold(configured)) ?? null : null;
  if (!company) return { queueId: base?.id ?? null, routedTo: null };
  const pme = base ? await resolvePmeQueueFor(tenantId, base.id) : null;
  const fallback = pme ?? active.find((queue) => fold(queue.name) === "fila pme renan") ?? active.find((queue) => isPmeQueueName(queue.name)) ?? null;
  return { queueId: fallback?.id ?? base?.id ?? null, routedTo: fallback && fallback.id !== base?.id ? fallback.name : null };
}

export type PublicFormIntakeResult =
  | { ok: true; leadId: string | null; duplicate: boolean }
  | { ok: false; code: "UNAVAILABLE" | "CONFLICT" | "FAILED" };

export async function receivePublicForm(
  submission: PublicFormSubmission,
  request: { requestId: string; userAgent: string | null; receivedAt: Date },
): Promise<PublicFormIntakeResult> {
  const config = publicFormConfig();
  if (!config) return { ok: false, code: "UNAVAILABLE" };
  let credential: Awaited<ReturnType<typeof authenticateLeadWebhook>>;
  try {
    credential = await authenticateLeadWebhook(config.token);
  } catch (error) {
    if (error instanceof WebhookAuthError) return { ok: false, code: "UNAVAILABLE" };
    throw error;
  }

  const lead = submissionToLeadData(submission);
  const company = submission.kind === "cnpj";
  const route = await resolveIntakeQueue(credential.tenantId, config.queue, company);
  const externalId = `formulario-${submission.idempotencyKey}`;

  const result = await createLeadFromWebhookSync({
    tenantId: credential.tenantId,
    branchId: credential.branchId,
    queueId: route.queueId,
    credentialId: credential.credentialId,
    createdByUserId: credential.createdBy,
    payload: { nome: submission.name, telefone: submission.phone, website: submission.website },
    idempotencyKey: externalId,
    requestMetadata: request,
    // O formulário já qualifica (23/11): sem a IA puxando conversa, o lead vai direto para a distribuição.
    // Antes, a primeira mensagem da IA falhava e o lead ficava desqualificado e retido.
    skipAiQualification: true,
    formData: lead.formData,
    livesCount: lead.livesCount,
    leadSource: {
      channel: PUBLIC_FORM_CHANNEL,
      externalId,
      leadType: lead.leadType,
      form: PUBLIC_FORM_CHANNEL,
      capturedAt: request.receivedAt,
      metadata: {
        entry: PUBLIC_FORM_CHANNEL,
        formAnswers: lead.formAnswers,
        ...(route.routedTo ? { companyRoutedToQueue: route.routedTo } : {}),
      },
    },
  });

  if (!result.success) return { ok: false, code: result.code === "IDEMPOTENCY_CONFLICT" ? "CONFLICT" : result.code === "BRANCH_NOT_FOUND" ? "UNAVAILABLE" : "FAILED" };
  return { ok: true, leadId: result.leadId === "honeypot-discarded" ? null : result.leadId, duplicate: result.duplicate };
}
