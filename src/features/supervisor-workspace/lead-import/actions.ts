"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { SUPERVISOR_IMPORT_MAX } from "./parse-contacts";
import { SupervisorImportError, distributeSupervisorLeads, importSupervisorContacts, reviewSupervisorList } from "./service";

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

export async function reviewTeamListAction(text: string) {
  return run(async () => reviewSupervisorList(await getRequiredTenantContext(), z.string().max(60_000).parse(text)));
}

const importSchema = z.object({
  consent: z.boolean(),
  contacts: z.array(z.object({ name: z.string().max(120), phone: z.string().max(20), email: z.string().max(160).nullable() })).min(1).max(SUPERVISOR_IMPORT_MAX),
});

export async function importTeamListAction(input: z.infer<typeof importSchema>) {
  return run(async () => {
    const result = await importSupervisorContacts(await getRequiredTenantContext(), importSchema.parse(input));
    revalidatePath("/leads");
    return result;
  });
}

const distributeSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  brokerIds: z.array(z.string().min(1)).min(1).max(100),
  counts: z.record(z.string(), z.number().int().min(0).max(500)).optional(),
});

export async function distributeTeamListAction(input: z.infer<typeof distributeSchema>) {
  return run(async () => {
    const result = await distributeSupervisorLeads(await getRequiredTenantContext(), distributeSchema.parse(input));
    revalidatePath("/leads");
    return result;
  });
}
