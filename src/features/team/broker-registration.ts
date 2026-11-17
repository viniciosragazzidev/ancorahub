import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import type { DatabaseExecutor } from "@/shared/db";
import { schema } from "@/shared/db";

/** Cadastro de corretor editável pelo supervisor: mesmas regras da criação do acesso. */
export const brokerRegistrationInput = z.object({
  name: z.string().trim().min(2, "Informe o nome do corretor.").max(120),
  email: z.string().trim().email("Informe um e-mail válido.").max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(10, "Informe um telefone válido com DDD.").max(30)
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 15, "Informe um telefone internacional válido."),
  cpf: z.string().trim().max(20).optional().or(z.literal("")).transform((value) => value?.replace(/\D/g, "") || null)
    .refine((value) => !value || value.length === 11, "Informe um CPF com 11 dígitos."),
  brokerCode: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado no código.").optional(),
  ),
});

export type BrokerRegistrationInput = z.output<typeof brokerRegistrationInput>;

/**
 * Confere, dentro da transação, que os campos informados não pertencem a outro
 * corretor da corretora. Campo omitido não é checado. O próprio perfil é ignorado.
 */
export async function assertBrokerRegistrationAvailable(tx: DatabaseExecutor, input: {
  tenantId: string;
  profileId: string;
  registration: { email?: string; phone?: string; cpf?: string | null; brokerCode?: string };
}) {
  const notSelf = ne(schema.brokerProfiles.id, input.profileId);
  const tenant = eq(schema.brokerProfiles.tenantId, input.tenantId);
  const { registration } = input;

  if (registration.email) {
    const [email] = await tx.select({ id: schema.brokerProfiles.id }).from(schema.brokerProfiles)
      .where(and(tenant, notSelf, eq(schema.brokerProfiles.invitedEmail, registration.email))).limit(1);
    if (email) throw new Error("Já existe um corretor com este e-mail.");
  }

  if (registration.phone) {
    const [phone] = await tx.select({ id: schema.brokerProfiles.id }).from(schema.brokerProfiles)
      .where(and(tenant, notSelf, eq(schema.brokerProfiles.phone, registration.phone))).limit(1);
    if (phone) throw new Error("Já existe um acesso com este telefone nesta corretora.");
  }

  if (registration.cpf) {
    const [cpf] = await tx.select({ id: schema.brokerProfiles.id }).from(schema.brokerProfiles)
      .where(and(tenant, notSelf, eq(schema.brokerProfiles.cpf, registration.cpf))).limit(1);
    if (cpf) throw new Error("Já existe um corretor com este CPF.");
  }

  if (registration.brokerCode) {
    const [code] = await tx.select({ id: schema.brokerProfiles.id }).from(schema.brokerProfiles)
      .where(and(tenant, notSelf, eq(schema.brokerProfiles.internalCode, registration.brokerCode))).limit(1);
    if (code) throw new Error("Já existe um corretor com este código nesta corretora.");
  }
}
