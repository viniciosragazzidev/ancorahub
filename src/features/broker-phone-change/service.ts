import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { brazilMobileVariants, isSameMobile, parseBrazilMobile } from "./phone-rules";

/** Uma recusa cuja mensagem pode ir para o corretor. */
export class BrokerPhoneChangeError extends Error {}

export type BrokerPhoneChangeResult = { phone: string };

type Actor = { tenantId: string; userId: string; role: string };

export const PHONE_CHANGE_AUDIT_ACTION = "alterou_telefone_proprio";

/**
 * O corretor troca o próprio celular (23/11/2026). Identidade e empresa vêm do contexto do servidor.
 * O número novo é validado, gravado como 55 + DDD + 9 dígitos e recusado se já for de outra pessoa da
 * mesma empresa (ele identifica o corretor nos avisos de lead, no plantão e na recuperação de senha).
 * A troca fica no log de auditoria com o valor antigo e o novo. Nenhuma mensagem é enviada ao número.
 */
export async function changeOwnPhone(actor: Actor, rawPhone: unknown, now = new Date()): Promise<BrokerPhoneChangeResult> {
  if (actor.role !== "broker") throw new BrokerPhoneChangeError("Só o corretor pode trocar o próprio telefone por aqui.");
  const parsed = parseBrazilMobile(rawPhone);
  if (!parsed.ok) throw new BrokerPhoneChangeError(parsed.error);

  const db = getDatabase();
  const [profile] = await db.select({ id: schema.brokerProfiles.id, phone: schema.brokerProfiles.phone })
    .from(schema.brokerProfiles)
    .where(and(eq(schema.brokerProfiles.tenantId, actor.tenantId), eq(schema.brokerProfiles.userId, actor.userId)))
    .limit(1);
  if (!profile) throw new BrokerPhoneChangeError("Não encontramos seu perfil de corretor. Nada foi alterado.");
  if (isSameMobile(profile.phone, parsed.national)) throw new BrokerPhoneChangeError("Esse já é o seu número.");

  await db.transaction(async (tx) => {
    // Duas trocas ao mesmo tempo na empresa não podem ficar com o mesmo número: uma espera a outra.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`broker-phone:${actor.tenantId}`}))`);

    const [owner] = await tx.select({ id: schema.brokerProfiles.id })
      .from(schema.brokerProfiles)
      .where(and(
        eq(schema.brokerProfiles.tenantId, actor.tenantId),
        ne(schema.brokerProfiles.id, profile.id),
        inArray(sql<string>`regexp_replace(coalesce(${schema.brokerProfiles.phone}, ''), '[^0-9]', '', 'g')`, brazilMobileVariants(parsed.national)),
      ))
      .limit(1);
    if (owner) throw new BrokerPhoneChangeError("Esse número já está no cadastro de outra pessoa da sua corretora. Confira o número ou fale com a gestão.");

    const [updated] = await tx.update(schema.brokerProfiles).set({ phone: parsed.phone, updatedAt: now })
      .where(and(
        eq(schema.brokerProfiles.id, profile.id),
        eq(schema.brokerProfiles.tenantId, actor.tenantId),
        eq(schema.brokerProfiles.userId, actor.userId),
        eq(schema.brokerProfiles.phone, profile.phone),
      ))
      .returning({ id: schema.brokerProfiles.id });
    if (!updated) throw new BrokerPhoneChangeError("Seu telefone mudou em outra tela. Atualize a página e tente de novo.");

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actor.userId,
      entidade: "broker_profile",
      entidadeId: profile.id,
      acao: PHONE_CHANGE_AUDIT_ACTION,
      metadata: { tenantId: actor.tenantId, fromPhone: profile.phone, toPhone: parsed.phone },
    });
  });

  return { phone: parsed.phone };
}
