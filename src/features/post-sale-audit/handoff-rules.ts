import { z } from "zod";

/**
 * Troca automática de corretor pelo pós-venda (24/11). Quando o cliente conta que ficou sem contato ou sem
 * continuidade, a IA avisa que outro corretor vai chamar e o lead volta para a fila, sem o corretor antigo.
 * Puro, sem I/O: interruptor por empresa (desligado por padrão) e quando o lead pode trocar de corretor.
 */

export const POST_SALE_HANDOFF_SOURCE = "post_sale";
export const POST_SALE_HANDOFF_AUDIT_ACTION = "lead.post_sale_redistributed";

/** Por quantos dias o corretor antigo fica fora das ofertas deste lead. */
export const POST_SALE_HANDOFF_EXCLUSION_DAYS = 30;

export type PostSaleHandoffSettings = { enabled: boolean };

const settingsSchema = z.object({ enabled: z.boolean().default(false) });

/** Chave em system_settings, por empresa. Ausente ou inválida = desligada. */
export function postSaleHandoffSettingKey(tenantId: string) {
  return `post_sale_handoff_${tenantId}`;
}

export function parsePostSaleHandoffSettings(raw: string | null | undefined): PostSaleHandoffSettings {
  if (!raw) return { enabled: false };
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { enabled: parsed.data.enabled } : { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export function serializePostSaleHandoffSettings(settings: PostSaleHandoffSettings) {
  return JSON.stringify({ enabled: settings.enabled });
}

/** Etapas em que o lead ainda está aberto com um corretor (sem Documentação, Em análise, vendido ou perdido). */
export const POST_SALE_HANDOFF_STATUSES = ["distributed", "in_contact", "contacted", "quote_sent", "negotiation", "awaiting_reply"] as const;

export type PostSaleHandoffSkip =
  | "disabled"
  | "no_broker"
  | "owner_changed"
  | "lead_closed"
  | "status"
  | "director_owner"
  | "auto_sale";

export type PostSaleHandoffEligibilityInput = {
  settings: PostSaleHandoffSettings;
  /** Corretor que o pós-venda avaliou (o da pesquisa). */
  surveyBrokerId: string | null;
  lead: {
    corretorId: string | null;
    status: string;
    deletedAt: Date | null;
    archivedAt: Date | null;
  } | null;
  /** Papel do dono atual do lead na empresa. */
  ownerRole: string | null;
  inAutoSale: boolean;
};

export function decidePostSaleHandoff(input: PostSaleHandoffEligibilityInput): { allowed: true } | { allowed: false; skip: PostSaleHandoffSkip } {
  const skip = (reason: PostSaleHandoffSkip) => ({ allowed: false as const, skip: reason });
  if (!input.settings.enabled) return skip("disabled");
  if (!input.lead || input.lead.deletedAt || input.lead.archivedAt) return skip("lead_closed");
  if (!input.lead.corretorId) return skip("no_broker");
  // O lead já mudou de mãos desde a pesquisa: quem está com ele agora não foi avaliado.
  if (input.surveyBrokerId && input.surveyBrokerId !== input.lead.corretorId) return skip("owner_changed");
  if (!(POST_SALE_HANDOFF_STATUSES as readonly string[]).includes(input.lead.status)) return skip("status");
  if (input.ownerRole === "director") return skip("director_owner");
  if (input.inAutoSale) return skip("auto_sale");
  return { allowed: true };
}

/** Texto da nota do lead e da notificação ao corretor antigo. */
export function postSaleHandoffNote(input: { leadName: string; contactStatus: "stalled" | "no_contact" | string }) {
  const why = input.contactStatus === "no_contact" ? "ficou sem contato" : "ficou sem continuidade do atendimento";
  return {
    timeline: `Pós-venda: o cliente contou que ${why}. O lead voltou para a fila e vai para outro corretor.`,
    brokerTitle: "Lead passado para outro corretor",
    brokerMessage: `${input.leadName}: o cliente contou ao pós-venda que ${why}. O lead foi para outro corretor.`,
  };
}
