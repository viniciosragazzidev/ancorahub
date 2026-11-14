import { z } from "zod";

/**
 * "Adicionar contato" da Minha carteira (etapa 4a): o formulário curto do Novo interessado. Só leva campos que
 * têm destino no cadastro manual existente (`createManualLead`): nome, telefone, e-mail e consentimento LGPD.
 * A observação vira a primeira nota do lead (`lead_interactions`). A origem é sempre `manual`, definida no
 * servidor; não há campo de origem livre porque o cadastro não guarda outra.
 */
export const brokerWalletContactSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Use até 120 caracteres."),
  telefone: z.string().trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 13, "Informe um celular com DDD (ex: 11 99999-9999)."),
  email: z.string().trim().max(254, "Use até 254 caracteres.").email("Informe um e-mail válido.").optional().or(z.literal("")),
  observacao: z.string().trim().max(2000, "A observação deve ter no máximo 2.000 caracteres.").optional().or(z.literal("")),
  consentimentoLgpd: z.literal(true, { message: "Confirme o consentimento LGPD para cadastrar." }),
  duplicateConfirmed: z.boolean().optional(),
});

export type BrokerWalletContactInput = z.input<typeof brokerWalletContactSchema>;
export type BrokerWalletContactField = "nome" | "telefone" | "email" | "observacao" | "consentimentoLgpd";

export type BrokerWalletContactResult =
  | { ok: true; leadId: string; noteSaved: boolean }
  | { ok: false; error: string; fieldErrors?: Partial<Record<BrokerWalletContactField, string>> }
  /**
   * Telefone já cadastrado na corretora. Do próprio corretor: nome e link do lead dele. De outro corretor ou sem
   * dono: só o aviso, sem nome, data ou responsável (nunca expõe dados de fora do escopo).
   */
  | { ok: false; duplicate: { mine: true; leadId: string; name: string } | { mine: false } };

export function parseBrokerWalletContactInput(raw: unknown):
  | { ok: true; data: z.output<typeof brokerWalletContactSchema> }
  | { ok: false; error: string; fieldErrors: Partial<Record<BrokerWalletContactField, string>> } {
  const parsed = brokerWalletContactSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Partial<Record<BrokerWalletContactField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in fieldErrors)) fieldErrors[field as BrokerWalletContactField] = issue.message;
  }
  return { ok: false, error: "Revise os campos destacados.", fieldErrors };
}

/** Converte para o formato que o cadastro manual existente aceita (formulário de /leads). */
export function toManualLeadInput(data: z.output<typeof brokerWalletContactSchema>) {
  return {
    nome: data.nome,
    telefone: data.telefone,
    email: data.email ?? "",
    tipo: "PF" as const,
    consentimentoLgpd: "true" as const,
    ...(data.duplicateConfirmed ? { duplicateConfirmed: "true" as const } : {}),
  };
}

/**
 * Duplicidade respeitando o escopo: o cadastro manual compara o telefone na corretora inteira; aqui só se
 * revela o lead quando ele é do próprio corretor (conferido pelo escopo canônico).
 */
export function describeBrokerWalletDuplicate(ownLead: { id: string; name: string } | null): Extract<BrokerWalletContactResult, { duplicate: unknown }> {
  return ownLead
    ? { ok: false, duplicate: { mine: true, leadId: ownLead.id, name: ownLead.name } }
    : { ok: false, duplicate: { mine: false } };
}
