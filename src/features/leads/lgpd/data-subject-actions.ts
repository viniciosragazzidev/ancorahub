"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { isR2StorageEnabled } from "@/features/storage/r2-storage-feature";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { deleteR2Object } from "@/shared/storage/r2-storage";

import {
  anonymizeAiConversationRow,
  anonymizeAutoSaleDealRow,
  anonymizeAutoSaleTurnRow,
  anonymizeProposalRow,
  anonymizeQuoteRow,
  anonymizeSaleRow,
  ANONYMIZED_NOTE_TEXT,
  buildLeadAnonymization,
  checkDataSubjectAccess,
  dataSubjectExportFilename,
  isLeadAnonymized,
  planLeadDocumentRemoval,
  validateAnonymizeRequest,
} from "./data-subject";
import { completeLgpdRequestFor, isLgpdRequestsReady } from "./lgpd-requests-store";

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
    const [[client], beneficiaries, notes, sales, documents] = await Promise.all([
      db.select({ id: schema.clients.id, nome: schema.clients.nome, telefone: schema.clients.telefone, email: schema.clients.email, convertedAt: schema.clients.convertedAt })
        .from(schema.clients).where(and(eq(schema.clients.leadId, lead.id), eq(schema.clients.tenantId, context.tenantId))).limit(1),
      db.select({ name: schema.leadBeneficiaries.name, cpf: schema.leadBeneficiaries.cpf, birthDate: schema.leadBeneficiaries.birthDate, age: schema.leadBeneficiaries.age, relationship: schema.leadBeneficiaries.relationship, isHolder: schema.leadBeneficiaries.isHolder })
        .from(schema.leadBeneficiaries).where(and(eq(schema.leadBeneficiaries.leadId, lead.id), eq(schema.leadBeneficiaries.tenantId, context.tenantId))),
      db.select({ conteudo: schema.leadInteractions.conteudo, createdAt: schema.leadInteractions.createdAt })
        .from(schema.leadInteractions).where(and(eq(schema.leadInteractions.leadId, lead.id), eq(schema.leadInteractions.tipo, "note"))).orderBy(asc(schema.leadInteractions.createdAt)),
      db.select({ saleDate: schema.sales.saleDate, status: schema.sales.status, policyNumber: schema.sales.policyNumber, coverageStartDate: schema.sales.coverageStartDate, notes: schema.sales.notes, postSaleNotes: schema.sales.postSaleNotes })
        .from(schema.sales).where(and(eq(schema.sales.leadId, lead.id), eq(schema.sales.tenantId, context.tenantId))),
      db.select({ filename: schema.leadDocuments.filename, category: schema.leadDocuments.category, status: schema.leadDocuments.status, createdAt: schema.leadDocuments.createdAt })
        .from(schema.leadDocuments).where(and(eq(schema.leadDocuments.leadId, lead.id), eq(schema.leadDocuments.tenantId, context.tenantId), isNull(schema.leadDocuments.deletedAt))),
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
      documentos: documents,
      mensagens: messages,
      mensagensLimitadas: messages.length >= MAX_EXPORTED_MESSAGES,
    };
    const requestReady = await isLgpdRequestsReady();
    await db.transaction(async (tx) => {
      // Pedido do titular (D+15): conclui o pedido aberto de exportação ou grava um já atendido.
      const request = requestReady
        ? await completeLgpdRequestFor(tx, { tenantId: context.tenantId, leadId: lead.id, kind: "export", userId: context.userId, reason: "Atendido na ficha do lead", now })
        : null;
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "lgpd.titular_exportado",
        metadata: { tenantId: context.tenantId, clientId: client?.id ?? null, mensagens: messages.length, pedidoId: request?.id ?? null },
      });
    });
    if (requestReady) revalidatePath("/settings");
    return { ok: true, filename: dataSubjectExportFilename(lead.id, now), content: JSON.stringify(payload, null, 2) };
  } catch {
    return { ok: false, error: "Não deu para gerar o arquivo agora." };
  }
}

/** Apaga os arquivos do armazenamento depois do commit. Falha não desfaz a anonimização: a chave fica para tentar de novo. */
async function deleteStoredFiles(keys: string[]) {
  if (!keys.length) return { deleted: new Set<string>(), pending: 0 };
  if (!(await isR2StorageEnabled().catch(() => false))) return { deleted: new Set<string>(), pending: keys.length };
  const results = await Promise.allSettled(keys.map(async (key) => { await deleteR2Object(key); return key; }));
  const deleted = new Set(results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])));
  return { deleted, pending: keys.length - deleted.size };
}

/**
 * "Anonimizar titular": troca nome, apaga contato, CPF e texto livre pessoal do lead, do cliente, dos beneficiários,
 * das anotações, das mensagens (e transcrições de áudio, que ficam no corpo da mensagem), das conversas da IA e da
 * venda automática, das cotações, propostas e anotações da venda, e remove os documentos enviados. Valores, apólice,
 * vidas e comissões ficam como estão; nenhum registro é apagado.
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
    const tenantId = context.tenantId;
    const requestReady = await isLgpdRequestsReady();
    const outcome = await getDatabase().transaction(async (tx) => {
      const [client] = await tx.select({ id: schema.clients.id, nome: schema.clients.nome }).from(schema.clients)
        .where(and(eq(schema.clients.leadId, lead.id), eq(schema.clients.tenantId, tenantId))).limit(1);
      await tx.update(schema.leads).set({ ...patch.lead, updatedAt: now })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, tenantId)));
      if (client) {
        await tx.update(schema.clients).set(patch.client).where(and(eq(schema.clients.id, client.id), eq(schema.clients.tenantId, tenantId)));
      }
      const beneficiaries = await tx.update(schema.leadBeneficiaries).set({ ...patch.beneficiary, updatedAt: now })
        .where(and(eq(schema.leadBeneficiaries.leadId, lead.id), eq(schema.leadBeneficiaries.tenantId, tenantId)))
        .returning({ id: schema.leadBeneficiaries.id });
      const notes = await tx.update(schema.leadInteractions).set(patch.note)
        .where(and(eq(schema.leadInteractions.leadId, lead.id), eq(schema.leadInteractions.tipo, "note")))
        .returning({ id: schema.leadInteractions.id });
      // O histórico de envio de documentos cita o nome do arquivo ("RG da Ana.pdf").
      await tx.update(schema.leadInteractions).set({ conteudo: ANONYMIZED_NOTE_TEXT })
        .where(and(eq(schema.leadInteractions.leadId, lead.id), eq(schema.leadInteractions.tipo, "document_upload")));

      // Mensagens e transcrições de áudio (o texto transcrito fica no corpo da mensagem).
      const messageScope = client
        ? or(eq(schema.whatsappMessages.leadId, lead.id), eq(schema.whatsappMessages.clientId, client.id))
        : eq(schema.whatsappMessages.leadId, lead.id);
      const messageMedia = await tx.select({ id: schema.whatsappMessages.id, storageKey: schema.whatsappMessages.mediaStorageKey })
        .from(schema.whatsappMessages)
        .where(and(eq(schema.whatsappMessages.tenantId, tenantId), messageScope, isNotNull(schema.whatsappMessages.mediaStorageKey)));
      const messages = await tx.update(schema.whatsappMessages).set(patch.message)
        .where(and(eq(schema.whatsappMessages.tenantId, tenantId), messageScope))
        .returning({ id: schema.whatsappMessages.id });

      // Documentos enviados: prova da venda fica retida (sem nome); o resto sai da ficha e do armazenamento.
      const [documents, saleRows, erpEvidence] = await Promise.all([
        tx.select({ id: schema.leadDocuments.id, storageKey: schema.leadDocuments.storageKey, deletedAt: schema.leadDocuments.deletedAt })
          .from(schema.leadDocuments).where(and(eq(schema.leadDocuments.leadId, lead.id), eq(schema.leadDocuments.tenantId, tenantId))),
        tx.select({ id: schema.sales.id, notes: schema.sales.notes, postSaleNotes: schema.sales.postSaleNotes, confirmationDocumentId: schema.sales.confirmationDocumentId })
          .from(schema.sales).where(and(eq(schema.sales.leadId, lead.id), eq(schema.sales.tenantId, tenantId))),
        tx.select({ nativeDocumentId: schema.erpDocuments.nativeDocumentId })
          .from(schema.erpDocuments).where(and(eq(schema.erpDocuments.tenantId, tenantId), eq(schema.erpDocuments.leadId, lead.id), isNotNull(schema.erpDocuments.nativeDocumentId))),
      ]);
      const protectedIds = new Set([
        ...saleRows.flatMap((sale) => (sale.confirmationDocumentId ? [sale.confirmationDocumentId] : [])),
        ...erpEvidence.flatMap((row) => (row.nativeDocumentId ? [row.nativeDocumentId] : [])),
      ]);
      const documentPlan = planLeadDocumentRemoval(documents, protectedIds);
      if (documents.length) {
        await tx.update(schema.leadDocuments).set({ ...patch.document, updatedAt: now })
          .where(and(eq(schema.leadDocuments.leadId, lead.id), eq(schema.leadDocuments.tenantId, tenantId)));
      }
      if (documentPlan.markRemoved.length) {
        await tx.update(schema.leadDocuments).set({ deletedAt: now, deletedBy: context.userId })
          .where(and(eq(schema.leadDocuments.tenantId, tenantId), inArray(schema.leadDocuments.id, documentPlan.markRemoved), isNull(schema.leadDocuments.deletedAt)));
      }

      // Anotações livres da venda; apólice, valores, vigência e status não mudam.
      for (const sale of saleRows) {
        const salePatch = anonymizeSaleRow(sale);
        if (salePatch.notes !== sale.notes || salePatch.postSaleNotes !== sale.postSaleNotes) {
          await tx.update(schema.sales).set({ ...salePatch, updatedAt: now }).where(and(eq(schema.sales.id, sale.id), eq(schema.sales.tenantId, tenantId)));
        }
      }

      // Cotações e propostas: nome e telefone do cliente, vidas e observações. Totais e itens ficam.
      const quotes = await tx.select({ id: schema.quotes.id, notes: schema.quotes.notes, lives: schema.quotes.lives })
        .from(schema.quotes).where(and(eq(schema.quotes.leadId, lead.id), eq(schema.quotes.tenantId, tenantId)));
      for (const quote of quotes) {
        await tx.update(schema.quotes).set({ ...patch.quote, ...anonymizeQuoteRow(quote), updatedAt: now })
          .where(and(eq(schema.quotes.id, quote.id), eq(schema.quotes.tenantId, tenantId)));
      }
      const proposals = await tx.select({ id: schema.proposals.id, title: schema.proposals.title, notes: schema.proposals.notes })
        .from(schema.proposals).where(and(eq(schema.proposals.leadId, lead.id), eq(schema.proposals.tenantId, tenantId)));
      for (const proposal of proposals) {
        await tx.update(schema.proposals).set({ ...patch.proposal, ...anonymizeProposalRow(proposal, [lead.nome, client?.nome]), updatedAt: now })
          .where(and(eq(schema.proposals.id, proposal.id), eq(schema.proposals.tenantId, tenantId)));
      }

      // Conversas da IA (qualificação) e da venda automática.
      const conversationScope = client
        ? or(eq(schema.aiConversations.leadId, lead.id), eq(schema.aiConversations.clientId, client.id))
        : eq(schema.aiConversations.leadId, lead.id);
      const conversations = await tx.select({ id: schema.aiConversations.id, qualificationSummary: schema.aiConversations.qualificationSummary, transferReason: schema.aiConversations.transferReason })
        .from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, tenantId), conversationScope));
      for (const conversation of conversations) {
        await tx.update(schema.aiConversations).set({ ...anonymizeAiConversationRow(conversation), updatedAt: now })
          .where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, tenantId)));
      }
      const deals = await tx.select({ id: schema.autoSaleDeals.id, facts: schema.autoSaleDeals.facts, managerCallReason: schema.autoSaleDeals.managerCallReason })
        .from(schema.autoSaleDeals).where(and(eq(schema.autoSaleDeals.leadId, lead.id), eq(schema.autoSaleDeals.tenantId, tenantId)));
      let turnCount = 0;
      for (const deal of deals) {
        await tx.update(schema.autoSaleDeals).set({ ...anonymizeAutoSaleDealRow(deal), updatedAt: now })
          .where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.tenantId, tenantId)));
        const turns = await tx.select({ id: schema.autoSaleTurns.id, body: schema.autoSaleTurns.body, facts: schema.autoSaleTurns.facts, decision: schema.autoSaleTurns.decision })
          .from(schema.autoSaleTurns).where(and(eq(schema.autoSaleTurns.dealId, deal.id), eq(schema.autoSaleTurns.tenantId, tenantId)));
        for (const turn of turns) {
          await tx.update(schema.autoSaleTurns).set(anonymizeAutoSaleTurnRow(turn))
            .where(and(eq(schema.autoSaleTurns.id, turn.id), eq(schema.autoSaleTurns.tenantId, tenantId)));
        }
        turnCount += turns.length;
      }

      // Pedido do titular (D+15): conclui o pedido aberto de anonimização ou grava um já atendido.
      const lgpdRequest = requestReady
        ? await completeLgpdRequestFor(tx, { tenantId, leadId: lead.id, kind: "anonymize", userId: context.userId, reason: request.reason, now })
        : null;

      // A auditoria guarda quem, quando e por quê; nunca o dado pessoal que saiu.
      const auditId = randomUUID();
      await tx.insert(schema.auditLogs).values({
        id: auditId,
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "lgpd.titular_anonimizado",
        metadata: {
          tenantId,
          motivo: request.reason,
          pedidoId: lgpdRequest?.id ?? null,
          clientId: client?.id ?? null,
          beneficiarios: beneficiaries.length,
          anotacoes: notes.length,
          mensagens: messages.length,
          documentosRemovidos: documentPlan.markRemoved.length,
          documentosRetidos: documentPlan.retained.length,
          vendas: saleRows.length,
          cotacoes: quotes.length,
          propostas: proposals.length,
          conversasIa: conversations.length,
          vendaAutomaticaVezes: turnCount,
        },
      });
      // Arquivo de documento retido nunca é apagado, nem quando a mesma chave aparece numa mensagem.
      const retainedKeys = new Set(documents.flatMap((document) => (protectedIds.has(document.id) && document.storageKey ? [document.storageKey] : [])));
      return {
        client: Boolean(client),
        auditId,
        documentFiles: documentPlan.filesToDelete.filter((file) => !retainedKeys.has(file.storageKey)),
        messageMedia: messageMedia.filter((media) => !media.storageKey || !retainedKeys.has(media.storageKey)),
      };
    });

    // Arquivos: só depois do commit. A chave sai do registro quando o arquivo some; a que falhou fica para tentar de novo.
    const db = getDatabase();
    const documentKeys = outcome.documentFiles.map((file) => file.storageKey);
    const mediaKeys = outcome.messageMedia.flatMap((media) => (media.storageKey ? [media.storageKey] : []));
    const files = await deleteStoredFiles([...new Set([...documentKeys, ...mediaKeys])]);
    const removedDocumentIds = outcome.documentFiles.filter((file) => files.deleted.has(file.storageKey)).map((file) => file.id);
    const removedMessageIds = outcome.messageMedia.filter((media) => media.storageKey && files.deleted.has(media.storageKey)).map((media) => media.id);
    if (removedDocumentIds.length) {
      await db.update(schema.leadDocuments).set({ storageKey: null, fileUrl: "", updatedAt: new Date() })
        .where(and(eq(schema.leadDocuments.tenantId, tenantId), inArray(schema.leadDocuments.id, removedDocumentIds))).catch(() => undefined);
    }
    if (removedMessageIds.length) {
      await db.update(schema.whatsappMessages).set({ mediaStorageKey: null, mediaSha256: null, mediaProviderId: null })
        .where(and(eq(schema.whatsappMessages.tenantId, tenantId), inArray(schema.whatsappMessages.id, removedMessageIds))).catch(() => undefined);
    }
    if (files.deleted.size || files.pending) {
      await db.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "lgpd.arquivos_apagados",
        metadata: { tenantId, anonimizacaoId: outcome.auditId, apagados: files.deleted.size, pendentes: files.pending },
      }).catch(() => undefined);
    }

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/leads");
    if (outcome.client) revalidatePath("/clientes");
    if (requestReady) revalidatePath("/settings");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não deu para anonimizar agora. Nada foi alterado." };
  }
}
