"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { buildLeadAnonymization, checkDataSubjectAccess, dataSubjectExportFilename, isLeadAnonymized, validateAnonymizeRequest } from "./data-subject";

/** Teto de mensagens no arquivo, para um histórico enorme não derrubar o servidor. */
const MAX_EXPORTED_MESSAGES = 5000;

export type DataSubjectExportResult = { ok: true; filename: string; content: string } | { ok: false; error: string };
export type DataSubjectAnonymizeResult = { ok: true } | { ok: false; error: string };

async function loadScopedLead(leadId: string) {
  const context = await getRequiredTenantContext();
  // Sempre com o tenant do contexto: lead de outra empresa nem é lido.
  const [lead] = await getDatabase().select().from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  return { context, lead, access: checkDataSubjectAccess(context, lead) };
}

/** "Exportar dados do titular": JSON com os dados pessoais do lead, do cliente, beneficiários, anotações e mensagens. */
export async function exportLeadDataSubjectAction(leadId: string): Promise<DataSubjectExportResult> {
  try {
    if (typeof leadId !== "string" || !leadId) return { ok: false, error: "Lead não encontrado." };
    const { context, lead, access } = await loadScopedLead(leadId);
    if (!access.ok || !lead) return { ok: false, error: access.ok ? "Lead não encontrado." : access.error };
    const db = getDatabase();
    const [[client], beneficiaries, notes, sales] = await Promise.all([
      db.select({ id: schema.clients.id, nome: schema.clients.nome, telefone: schema.clients.telefone, email: schema.clients.email, convertedAt: schema.clients.convertedAt })
        .from(schema.clients).where(and(eq(schema.clients.leadId, lead.id), eq(schema.clients.tenantId, context.tenantId))).limit(1),
      db.select({ name: schema.leadBeneficiaries.name, cpf: schema.leadBeneficiaries.cpf, birthDate: schema.leadBeneficiaries.birthDate, age: schema.leadBeneficiaries.age, relationship: schema.leadBeneficiaries.relationship, isHolder: schema.leadBeneficiaries.isHolder })
        .from(schema.leadBeneficiaries).where(and(eq(schema.leadBeneficiaries.leadId, lead.id), eq(schema.leadBeneficiaries.tenantId, context.tenantId))),
      db.select({ conteudo: schema.leadInteractions.conteudo, createdAt: schema.leadInteractions.createdAt })
        .from(schema.leadInteractions).where(and(eq(schema.leadInteractions.leadId, lead.id), eq(schema.leadInteractions.tipo, "note"))).orderBy(asc(schema.leadInteractions.createdAt)),
      db.select({ saleDate: schema.sales.saleDate, status: schema.sales.status, policyNumber: schema.sales.policyNumber, coverageStartDate: schema.sales.coverageStartDate })
        .from(schema.sales).where(and(eq(schema.sales.leadId, lead.id), eq(schema.sales.tenantId, context.tenantId))),
    ]);
    const messageScope = client
      ? or(eq(schema.whatsappMessages.leadId, lead.id), eq(schema.whatsappMessages.clientId, client.id))
      : eq(schema.whatsappMessages.leadId, lead.id);
    const messages = await db.select({ direction: schema.whatsappMessages.direction, phone: schema.whatsappMessages.phone, body: schema.whatsappMessages.body, mediaKind: schema.whatsappMessages.mediaKind, mediaFilename: schema.whatsappMessages.mediaFilename, sentAt: schema.whatsappMessages.sentAt })
      .from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), messageScope))
      .orderBy(asc(schema.whatsappMessages.sentAt)).limit(MAX_EXPORTED_MESSAGES);

    const now = new Date();
    const payload = {
      geradoEm: now.toISOString(),
      observacao: "Dados pessoais do titular guardados pela corretora (LGPD, art. 18).",
      titular: {
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        tipo: lead.tipo,
        consentimentoLgpd: lead.consentimentoLgpd,
        criadoEm: lead.createdAt,
        origem: lead.origem,
        dadosDoCadastro: lead.formData,
        dadosDaQualificacao: lead.qualificationDetails,
      },
      cliente: client ? { nome: client.nome, telefone: client.telefone, email: client.email, convertidoEm: client.convertedAt } : null,
      beneficiarios: beneficiaries,
      anotacoes: notes,
      contratos: sales,
      mensagens: messages,
      mensagensLimitadas: messages.length >= MAX_EXPORTED_MESSAGES,
    };
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: "lgpd.titular_exportado",
      metadata: { tenantId: context.tenantId, clientId: client?.id ?? null, mensagens: messages.length },
    });
    return { ok: true, filename: dataSubjectExportFilename(lead.id, now), content: JSON.stringify(payload, null, 2) };
  } catch {
    return { ok: false, error: "Não deu para gerar o arquivo agora." };
  }
}

/**
 * "Anonimizar titular": troca nome, apaga contato, CPF e texto livre pessoal do lead, do cliente, dos beneficiários,
 * das anotações e das mensagens. Vendas, comissões e números ficam como estão; nenhum registro é apagado.
 */
export async function anonymizeLeadDataSubjectAction(input: { leadId: string; confirmation: string; reason: string }): Promise<DataSubjectAnonymizeResult> {
  try {
    const request = validateAnonymizeRequest(input ?? {});
    if (!request.ok) return { ok: false, error: request.error };
    if (typeof input.leadId !== "string" || !input.leadId) return { ok: false, error: "Lead não encontrado." };
    const { context, lead, access } = await loadScopedLead(input.leadId);
    if (!access.ok || !lead) return { ok: false, error: access.ok ? "Lead não encontrado." : access.error };
    if (isLeadAnonymized(lead)) return { ok: false, error: "Este titular já foi anonimizado." };

    const patch = buildLeadAnonymization(lead);
    const now = new Date();
    const counts = await getDatabase().transaction(async (tx) => {
      const [client] = await tx.select({ id: schema.clients.id }).from(schema.clients)
        .where(and(eq(schema.clients.leadId, lead.id), eq(schema.clients.tenantId, context.tenantId))).limit(1);
      await tx.update(schema.leads).set({ ...patch.lead, updatedAt: now })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));
      if (client) {
        await tx.update(schema.clients).set(patch.client).where(and(eq(schema.clients.id, client.id), eq(schema.clients.tenantId, context.tenantId)));
      }
      const beneficiaries = await tx.update(schema.leadBeneficiaries).set({ ...patch.beneficiary, updatedAt: now })
        .where(and(eq(schema.leadBeneficiaries.leadId, lead.id), eq(schema.leadBeneficiaries.tenantId, context.tenantId)))
        .returning({ id: schema.leadBeneficiaries.id });
      const notes = await tx.update(schema.leadInteractions).set(patch.note)
        .where(and(eq(schema.leadInteractions.leadId, lead.id), eq(schema.leadInteractions.tipo, "note")))
        .returning({ id: schema.leadInteractions.id });
      const messageScope = client
        ? or(eq(schema.whatsappMessages.leadId, lead.id), eq(schema.whatsappMessages.clientId, client.id))
        : eq(schema.whatsappMessages.leadId, lead.id);
      const messages = await tx.update(schema.whatsappMessages).set(patch.message)
        .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), messageScope))
        .returning({ id: schema.whatsappMessages.id });
      // A auditoria guarda quem, quando e por quê; nunca o dado pessoal que saiu.
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "lgpd.titular_anonimizado",
        metadata: { tenantId: context.tenantId, motivo: request.reason, clientId: client?.id ?? null, beneficiarios: beneficiaries.length, anotacoes: notes.length, mensagens: messages.length },
      });
      return { client: Boolean(client) };
    });
    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/leads");
    if (counts.client) revalidatePath("/clientes");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não deu para anonimizar agora. Nada foi alterado." };
  }
}
