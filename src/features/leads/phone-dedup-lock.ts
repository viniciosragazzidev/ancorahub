import { sql } from "drizzle-orm";

import type { DatabaseExecutor } from "@/shared/db";

/** Shared key protocol for every tenant lead intake path, matching Meta's original lock. */
export function leadPhoneLockKey(phone: string) {
  return phone.replace(/\D/g, "").slice(-8);
}

export function sameLeadPhone(left: string, right: string) {
  const a = left.replace(/\D/g, "");
  const b = right.replace(/\D/g, "");
  if (!a || !b) return false;
  if (a === b || a.endsWith(b) || b.endsWith(a)) return true;
  return (a.length >= 11 ? a.slice(-11) : a) === (b.length >= 11 ? b.slice(-11) : b)
    || (a.length >= 10 ? a.slice(-10) : a) === (b.length >= 10 ? b.slice(-10) : b);
}

export async function lockLeadCreationByPhone(tx: DatabaseExecutor, tenantId: string, phone: string) {
  const phoneKey = leadPhoneLockKey(phone);
  if (phoneKey.length !== 8) throw new Error("Informe um telefone válido para proteger a criação do lead.");
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${phoneKey}))`);
  return phoneKey;
}
