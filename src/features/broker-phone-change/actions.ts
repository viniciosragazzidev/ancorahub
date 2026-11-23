"use server";

import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { BrokerPhoneChangeError, changeOwnPhone } from "./service";

export type ChangeOwnPhoneState = { ok: true; phone: string } | { ok: false; error: string };

/** O corretor troca o próprio celular em Configurações. Tudo é conferido de novo no servidor. */
export async function changeOwnPhoneAction(rawPhone: unknown): Promise<ChangeOwnPhoneState> {
  try {
    const context = await getRequiredTenantContext();
    const result = await changeOwnPhone(context, rawPhone);
    revalidatePath("/settings");
    return { ok: true, phone: result.phone };
  } catch (error) {
    if (error instanceof BrokerPhoneChangeError) return { ok: false, error: error.message };
    return { ok: false, error: "Não consegui trocar seu telefone agora. Tente de novo em instantes." };
  }
}
