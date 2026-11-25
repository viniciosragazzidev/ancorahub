"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { askListStructure } from "./ai-structure";
import { AI_TABLE_ROWS, AI_TEXT_LINES } from "./organize";
import { SUPERVISOR_IMPORT_CHUNK, SUPERVISOR_IMPORT_MAX } from "./parse-contacts";
import { SupervisorImportError, distributeSupervisorLeads, importSupervisorContacts, isSupervisorImportEnabled, renameSupervisorLeadList, reviewSupervisorList } from "./service";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    if (error instanceof SupervisorImportError || error instanceof z.ZodError) {
      return { ok: false, error: error instanceof z.ZodError ? "Confira os dados enviados." : error.message };
    }
    console.error("[supervisor-import]", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não consegui concluir agora. Nada foi alterado. Tente de novo." };
  }
}

const structureSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tabela"), rows: z.array(z.array(z.string().max(80)).max(15)).max(AI_TABLE_ROWS) }),
  z.object({ kind: z.literal("texto"), lines: z.array(z.string().max(200)).max(AI_TEXT_LINES) }),
]);

/** Ajuda da IA quando a leitura automática fica em dúvida. Só a estrutura, mascarada. */
export async function structureTeamListAction(request: z.infer<typeof structureSchema>) {
  return run(async () => {
    const context = await getRequiredTenantContext();
    if (context.role !== "supervisor" || !(await isSupervisorImportEnabled())) throw new SupervisorImportError("Só o supervisor importa a lista da equipe.");
    return askListStructure(context, structureSchema.parse(request));
  });
}

export async function reviewTeamListAction(phones: string[]) {
  return run(async () => reviewSupervisorList(await getRequiredTenantContext(), z.array(z.string().max(30)).max(SUPERVISOR_IMPORT_MAX).parse(phones)));
}

const importSchema = z.object({
  consent: z.boolean(),
  importId: z.string().uuid(),
  // Limites folgados: o servidor relê e descarta o contato estranho; um campo grande não derruba o bloco.
  contacts: z.array(z.object({ name: z.string().max(400), phone: z.string().max(40), email: z.string().max(254).nullable(), note: z.string().max(400).nullable() })).min(1).max(SUPERVISOR_IMPORT_CHUNK),
  listName: z.string().max(200).nullable().optional(),
  rejected: z.number().int().min(0).max(SUPERVISOR_IMPORT_MAX * 10).optional(),
  duplicatesBefore: z.number().int().min(0).max(SUPERVISOR_IMPORT_MAX * 10).optional(),
  firstContactHours: z.number().int().min(1).max(720).nullable().optional(),
});

export async function importTeamListAction(input: z.infer<typeof importSchema>) {
  return run(async () => {
    const result = await importSupervisorContacts(await getRequiredTenantContext(), importSchema.parse(input));
    revalidatePath("/leads");
    return result;
  });
}

const distributeSchema = z.object({
  counts: z.record(z.string().min(1), z.number().int().min(0).max(SUPERVISOR_IMPORT_MAX)),
  leadIds: z.array(z.string().min(1)).max(SUPERVISOR_IMPORT_MAX).optional(),
  listId: z.string().min(1).max(80).nullable().optional(),
});

const renameSchema = z.object({ listId: z.string().min(1).max(80), name: z.string().max(200) });

/** Renomear uma lista de importação (DEC-191). Só o supervisor dono; auditado no serviço. */
export async function renameTeamListAction(input: z.infer<typeof renameSchema>) {
  return run(async () => {
    const result = await renameSupervisorLeadList(await getRequiredTenantContext(), renameSchema.parse(input));
    revalidatePath("/leads");
    return result;
  });
}

export async function distributeTeamListAction(input: z.infer<typeof distributeSchema>) {
  return run(async () => {
    const result = await distributeSupervisorLeads(await getRequiredTenantContext(), distributeSchema.parse(input));
    revalidatePath("/leads");
    return result;
  });
}
