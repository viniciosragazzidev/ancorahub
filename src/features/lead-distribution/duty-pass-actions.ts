"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServerAgentBackend } from "@/features/agent/backend-server";
import { isOutsideManagerScope, MANAGER_DISTRIBUTION_REFUSAL } from "@/features/manager-scope/manager-routes";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { requireCargoCapability } from "@/shared/auth/authorization";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { leavingProblem, passSeat, passSeatLabel, passWarningText, seatPassCheck, type PassWarning } from "./duty-pass";
import { canManageSwaps } from "./duty-swap";

/**
 * Passar o plantão pela tela (23/11): A sai de uma ocorrência e B entra, sem B precisar de
 * escala em outro dia. Reaproveita o leitor e as escritas do agente do diretor (publicado,
 * rascunho e avulso), que já passam pelas ações da escala: permissão, escopo do gestor,
 * auditoria e aviso no app para quem sai e quem entra. Nada vai por WhatsApp.
 */

const OCCURRENCE_ID = z.string().min(12).max(160).regex(/:\d{4}-\d{2}-\d{2}$/);
const PERSON_ID = z.string().min(1).max(120);

async function passScope() {
  const context = await getRequiredTenantContext();
  await requireCargoCapability(context, "duty_schedules_manage");
  if (isOutsideManagerScope(context.role, context.jobTitle)) throw new Error(MANAGER_DISTRIBUTION_REFUSAL);
  if (!canManageSwaps(context.role)) throw new Error("Apenas Diretores e Gestores podem passar plantões.");
  if ((await getFeatureFlag(FEATURE_FLAGS.DUTY_SEAT_PASS)) !== "true") throw new Error("Passar o plantão está desativado pelo Super-admin.");
  return context;
}

async function loadDay(context: Awaited<ReturnType<typeof passScope>>, occurrenceId: string) {
  const backend = createServerAgentBackend(context);
  const dutyDate = occurrenceId.slice(-10);
  const [seats, people] = await Promise.all([backend.listSeats({ from: dutyDate, until: dutyDate }), backend.listPeople()]);
  return { backend, seats, people, seat: seats.find((item) => item.id === occurrenceId) ?? null };
}

export type DutyPassCandidate = {
  id: string;
  name: string;
  code: string | null;
  branchName: string | null;
  warnings: PassWarning[];
  /** Texto de cada aviso, na ordem de `warnings`. */
  warningTexts: string[];
};

export type DutyPassOptions =
  | { ok: true; seat: { id: string; label: string; source: "published" | "draft" | "avulso" }; from: { id: string; name: string }; candidates: DutyPassCandidate[] }
  | { ok: false; reason: string };

/** Quem pode entrar no lugar de `fromBrokerId` nesta ocorrência, com os avisos de cada um. */
export async function listDutyPassOptionsAction(input: unknown): Promise<DutyPassOptions> {
  try {
    const { occurrenceId, fromBrokerId } = z.object({ occurrenceId: OCCURRENCE_ID, fromBrokerId: PERSON_ID }).strict().parse(input);
    const context = await passScope();
    const { seat, seats, people } = await loadDay(context, occurrenceId);
    const from = people.find((person) => person.id === fromBrokerId) ?? null;
    if (!from) return { ok: false, reason: "Não achei quem sai. Atualize a página." };
    const leaving = leavingProblem(seat, from);
    if (leaving || !seat) return { ok: false, reason: leaving?.reason ?? "Plantão não encontrado. Atualize a página." };
    // Gestor: só corretores da unidade dele (a escrita confere de novo).
    const pool = people.filter((person) => person.role === "broker" && person.status === "active" && person.id !== from.id && !seat.brokerIds.includes(person.id)
      && (context.role !== "manager" || person.branchId === (context.branchId ?? null)));
    const db = getDatabase();
    const codes = pool.length
      ? await db.select({ userId: schema.brokerProfiles.userId, code: schema.brokerProfiles.internalCode }).from(schema.brokerProfiles)
        .where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), inArray(schema.brokerProfiles.userId, pool.map((person) => person.id))))
      : [];
    const codeOf = new Map(codes.map((row) => [row.userId, row.code ?? null]));
    const candidates = pool.flatMap((person) => {
      const check = seatPassCheck({ seat, from, to: person, sameDaySeats: seats });
      if (!check.ok) return [];
      return [{
        id: person.id,
        name: person.name,
        code: codeOf.get(person.id) ?? null,
        branchName: person.branchName,
        warnings: check.warnings,
        warningTexts: check.warnings.map((warning) => passWarningText(warning, person.name, seat, check.overlapping)),
      }];
    }).sort((a, b) => a.warnings.length - b.warnings.length || a.name.localeCompare(b.name, "pt-BR"));
    return { ok: true, seat: { id: seat.id, label: passSeatLabel(seat), source: seat.source }, from: { id: from.id, name: from.name }, candidates };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível carregar quem pode entrar." };
  }
}

export type DutyPassResult =
  | { ok: true; message: string; fromName: string; toName: string; undo: { occurrenceId: string; fromBrokerId: string; toBrokerId: string } }
  | { ok: false; reason: string; warnings?: string[] };

const passInput = z.object({
  occurrenceId: OCCURRENCE_ID,
  fromBrokerId: PERSON_ID,
  toBrokerId: PERSON_ID,
  /** Aceites do cartão de confirmação. */
  acceptOutsideType: z.boolean().optional(),
  acceptOverlap: z.boolean().optional(),
}).strict();

/** Tira A e põe B na ocorrência. Avisos não aceitos voltam como recusa com o texto do aviso. */
export async function passDutySeatAction(input: unknown): Promise<DutyPassResult> {
  try {
    const parsed = passInput.safeParse(input);
    if (!parsed.success) return { ok: false, reason: "Dados inválidos para passar o plantão." };
    const { occurrenceId, fromBrokerId, toBrokerId, acceptOutsideType, acceptOverlap } = parsed.data;
    const context = await passScope();
    const { backend, seat, seats, people } = await loadDay(context, occurrenceId);
    const from = people.find((person) => person.id === fromBrokerId) ?? null;
    const to = people.find((person) => person.id === toBrokerId) ?? null;
    if (context.role === "manager" && to && to.branchId !== (context.branchId ?? null)) return { ok: false, reason: "Você só pode passar plantões para corretores da sua unidade." };
    const check = seatPassCheck({ seat, from, to, sameDaySeats: seats });
    if (!check.ok) return { ok: false, reason: check.reason };
    const pending = check.warnings.filter((warning) => (warning === "fora_do_tipo" ? !acceptOutsideType : !acceptOverlap));
    if (pending.length) {
      return { ok: false, reason: "Confirme os avisos antes de passar.", warnings: pending.map((warning) => passWarningText(warning, to!.name, seat!, check.overlapping)) };
    }
    await passSeat(backend, seat!, from!.id, to!.id, Boolean(acceptOutsideType));

    const db = getDatabase();
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "duty_occurrence",
      entidadeId: occurrenceId,
      acao: "duty_roster.passed",
      metadata: { fromBrokerId: from!.id, toBrokerId: to!.id, source: seat!.source, warnings: check.warnings, channel: "tela" },
    }).catch((error) => console.error("[plantao] audit_pass_failed", error instanceof Error ? error.name : "unknown_error"));

    revalidatePath("/leads/distribuicao", "layout");
    revalidatePath("/distribuicao");
    revalidatePath("/minha-fila");
    revalidatePath("/plantoes");
    return {
      ok: true,
      message: `${passSeatLabel(seat!)}: saiu ${from!.name}, entrou ${to!.name}.`,
      fromName: from!.name,
      toName: to!.name,
      undo: { occurrenceId, fromBrokerId: to!.id, toBrokerId: from!.id },
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Não foi possível passar o plantão." };
  }
}
