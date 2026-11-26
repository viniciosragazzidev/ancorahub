"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { isLeadAnonymized } from "./data-subject";
import { validateRegisterLgpdRequest, type LgpdRequestKind } from "./lgpd-requests";
import { isLgpdRequestsReady, type LgpdRequestRow } from "./lgpd-requests-store";

export type LgpdLeadOption = { id: string; label: string; detail: string };
export type LgpdLeadSearchResult = { ok: true; leads: LgpdLeadOption[] } | { ok: false; error: string };
export type RegisterLgpdRequestResult = { ok: true; row: LgpdRequestRow } | { ok: false; error: string };

const NOT_READY = "O registro de pedidos ainda não está pronto nesta empresa (falta a migration 0240).";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `final ${digits.slice(-4)}` : "sem telefone";
}

/** Busca do lead em "Registrar pedido": só o diretor, só a própria empresa, por nome ou telefone. */
export async function searchLgpdLeadsAction(query: string): Promise<LgpdLeadSearchResult> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor atende pedidos do titular." };
    const term = typeof query === "string" ? query.trim().slice(0, 80) : "";
    if (term.length < 2) return { ok: true, leads: [] };
    const digits = term.replace(/\D/g, "");
    const like = `%${term.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
    const rows = await getDatabase()
      .select({ id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone, createdAt: schema.leads.createdAt })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
        digits.length >= 4 ? or(ilike(schema.leads.nome, like), ilike(schema.leads.telefone, `%${digits}%`)) : ilike(schema.leads.nome, like),
      ))
      .orderBy(desc(schema.leads.createdAt))
      .limit(8);
    return {
      ok: true,
      leads: rows.map((row) => ({
        id: row.id,
        label: row.nome,
        detail: isLeadAnonymized(row) ? "Já anonimizado" : maskPhone(row.telefone),
      })),
    };
  } catch {
    return { ok: false, error: "Não deu para buscar agora." };
  }
}

/** "Registrar pedido": pedido que chegou por e-mail ou telefone e ainda não foi atendido. Fica em aberto. */
export async function registerLgpdRequestAction(input: { leadId: string; kind: LgpdRequestKind; reason: string; requestedOn: string }): Promise<RegisterLgpdRequestResult> {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { ok: false, error: "Só o diretor atende pedidos do titular." };
    const check = validateRegisterLgpdRequest(input ?? { leadId: null, kind: null, reason: null, requestedOn: null });
    if (!check.ok) return check;
    if (!(await isLgpdRequestsReady())) return { ok: false, error: NOT_READY };
    const db = getDatabase();
    const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone }).from(schema.leads)
      .where(and(eq(schema.leads.id, check.leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt))).limit(1);
    if (!lead) return { ok: false, error: "Lead não encontrado." };
    const anonymized = isLeadAnonymized(lead);
    if (check.kind === "anonymize" && anonymized) return { ok: false, error: "Este titular já foi anonimizado." };
    const [existing] = await db.select({ id: schema.lgpdRequests.id }).from(schema.lgpdRequests)
      .where(and(eq(schema.lgpdRequests.tenantId, context.tenantId), eq(schema.lgpdRequests.leadId, lead.id), eq(schema.lgpdRequests.kind, check.kind), isNull(schema.lgpdRequests.completedAt)))
      .limit(1);
    if (existing) return { ok: false, error: "Já existe um pedido aberto deste tipo para este titular." };

    const id = randomUUID();
    await db.insert(schema.lgpdRequests).values({
      id,
      tenantId: context.tenantId,
      leadId: lead.id,
      kind: check.kind,
      reason: check.reason,
      requestedAt: check.requestedAt,
      dueAt: check.dueAt,
      createdBy: context.userId,
    });
    // A auditoria guarda quem registrou e o prazo; nunca o dado pessoal do titular.
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: "lgpd.pedido_registrado",
      metadata: { tenantId: context.tenantId, pedidoId: id, tipo: check.kind, prazo: check.dueAt.toISOString() },
    });
    revalidatePath("/settings");
    return {
      ok: true,
      row: {
        id,
        leadId: lead.id,
        holder: lead.nome,
        anonymized,
        kind: check.kind,
        reason: check.reason,
        requestedAt: check.requestedAt.toISOString(),
        dueAt: check.dueAt.toISOString(),
        completedAt: null,
        completedByName: null,
      },
    };
  } catch {
    return { ok: false, error: "Não deu para registrar o pedido agora." };
  }
}
