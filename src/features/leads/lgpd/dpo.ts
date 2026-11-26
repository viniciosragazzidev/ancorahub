/**
 * Encarregado de dados (DPO, LGPD art. 41), 26/11/2026. O diretor cadastra nome, e-mail e telefone em
 * Configurações > Privacidade; o nome e o e-mail aparecem num rodapé curto no formulário público e nos termos.
 * Fica guardado por empresa em system_settings (`lgpd_dpo:<tenantId>`), como as outras escolhas do diretor:
 * sem migration. Regra pura, sem banco, para valer igual no servidor, na tela e nos testes.
 */

export type DataProtectionOfficer = {
  name: string;
  email: string;
  phone: string | null;
  updatedAt: string | null;
};

export const MAX_DPO_NAME_LENGTH = 120;
export const MAX_DPO_EMAIL_LENGTH = 160;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function dpoKey(tenantId: string) {
  return `lgpd_dpo:${tenantId}`;
}

const clean = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const digits = (value: string) => value.replace(/\D/g, "");

export type DpoValidation =
  | { ok: true; dpo: Omit<DataProtectionOfficer, "updatedAt"> }
  | { ok: false; field: "name" | "email" | "phone"; error: string };

/** Nome e e-mail obrigatórios; telefone opcional, com DDD. Tudo vazio apaga o cadastro (ver `isEmptyDpoInput`). */
export function validateDpoInput(input: { name?: unknown; email?: unknown; phone?: unknown }): DpoValidation {
  const name = clean(input.name);
  const email = clean(input.email).toLowerCase();
  const phone = clean(input.phone);
  if (name.length < 2 || name.length > MAX_DPO_NAME_LENGTH) return { ok: false, field: "name", error: "Informe o nome do encarregado." };
  if (!EMAIL_PATTERN.test(email) || email.length > MAX_DPO_EMAIL_LENGTH) return { ok: false, field: "email", error: "Informe um e-mail válido." };
  if (phone && (digits(phone).length < 10 || digits(phone).length > 13)) return { ok: false, field: "phone", error: "Informe o telefone com DDD." };
  return { ok: true, dpo: { name, email, phone: phone || null } };
}

export function isEmptyDpoInput(input: { name?: unknown; email?: unknown; phone?: unknown }) {
  return !clean(input.name) && !clean(input.email) && !clean(input.phone);
}

export function serializeDpo(dpo: DataProtectionOfficer) {
  return JSON.stringify(dpo);
}

/** Valor salvo inválido ou vazio vale como "sem encarregado": o rodapé some em vez de mostrar dado quebrado. */
export function parseDpo(raw: string | null | undefined): DataProtectionOfficer | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const check = validateDpoInput(value);
    if (!check.ok) return null;
    return { ...check.dpo, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null };
  } catch {
    return null;
  }
}

/** O rodapé público: "Encarregado de dados: Nome, e-mail". Sem cadastro, nada. */
export function dpoFooterText(dpo: Pick<DataProtectionOfficer, "name" | "email"> | null | undefined): string | null {
  if (!dpo?.name?.trim() || !dpo.email?.trim()) return null;
  return `Encarregado de dados: ${dpo.name.trim()}, ${dpo.email.trim()}`;
}
