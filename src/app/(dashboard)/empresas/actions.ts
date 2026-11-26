"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { cnpjDigits } from "@/features/companies/cnpj";
import { lookupCnpj, type CnpjLookupResult } from "@/features/companies/cnpj-lookup";
import { buildCompanyReadScope } from "@/features/companies/read-scope";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

async function canReadCompanies() {
  const context = await getRequiredTenantContext();
  const allowed = await hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "acessar_leads",
  });
  return allowed ? context : null;
}

/** Consulta o CNPJ na BrasilAPI pelo servidor. Só o CNPJ sai daqui. */
export async function consultarCnpjAction(cnpj: string): Promise<CnpjLookupResult> {
  if (!(await canReadCompanies())) return { ok: false, reason: "Você não tem acesso às empresas.", retryable: false };
  return lookupCnpj(String(cnpj ?? ""));
}

export type UsarDadosCnpjResult = { ok: true; legalName: string; cnpj: string } | { ok: false; reason: string; retryable: boolean };

/**
 * "Usar estes dados": grava a razão social da Receita no cadastro da empresa. Só por ação explícita, só diretor
 * (empresa toda) ou gestor (a unidade dele). Os dados vêm de nova consulta no servidor, nunca do navegador.
 */
export async function usarDadosCnpjAction(input: { companyId: string; cnpj: string }): Promise<UsarDadosCnpjResult> {
  const context = await canReadCompanies();
  if (!context || (context.role !== "director" && context.role !== "manager")) {
    return { ok: false, reason: "Só a direção e a gestão da unidade alteram o cadastro da empresa.", retryable: false };
  }
  const db = getDatabase();
  const [company] = await db
    .select({ id: schema.companies.id, cnpj: schema.companies.cnpj })
    .from(schema.companies)
    .where(and(eq(schema.companies.id, String(input.companyId ?? "")), buildCompanyReadScope(context)))
    .limit(1);
  if (!company) return { ok: false, reason: "Empresa não encontrada no seu acesso.", retryable: false };

  const lookup = await lookupCnpj(String(input.cnpj ?? ""));
  if (!lookup.ok) return lookup;
  const digits = cnpjDigits(lookup.data.cnpj);
  if (company.cnpj && cnpjDigits(company.cnpj) !== digits) {
    return { ok: false, reason: "O CNPJ consultado não é o desta empresa.", retryable: false };
  }
  if (!company.cnpj) {
    const [taken] = await db
      .select({ id: schema.companies.id })
      .from(schema.companies)
      .where(and(eq(schema.companies.tenantId, context.tenantId), eq(schema.companies.cnpj, digits), ne(schema.companies.id, company.id)))
      .limit(1);
    if (taken) return { ok: false, reason: "Outra empresa da corretora já usa este CNPJ.", retryable: false };
  }

  await db
    .update(schema.companies)
    .set({ legalName: lookup.data.legalName, cnpj: digits, updatedAt: new Date() })
    .where(and(eq(schema.companies.id, company.id), eq(schema.companies.tenantId, context.tenantId)));
  revalidatePath("/empresas");
  return { ok: true, legalName: lookup.data.legalName, cnpj: digits };
}
