/**
 * Prazo do primeiro contato dos leads da lista interna da equipe (25/11/2026, pedido do Vinicios).
 *
 * Lead importado pelo supervisor é lista fria: não vira pendência na hora em que chega ao corretor. Ele só
 * passa a "esperar você" depois do prazo escolhido na importação (24 h por padrão) sem primeiro contato. O lead
 * quente distribuído (plantão, fila, oferta) continua com o SLA da empresa, sem mudança.
 *
 * O prazo fica em `leads.source_metadata.firstContactHours` (jsonb já existente, sem migration).
 */

/** Mesmo valor de `SUPERVISOR_IMPORT_SOURCE` (lead-import/service.ts), repetido aqui para não puxar código de servidor. */
export const TEAM_LIST_SOURCE_CHANNEL = "supervisor_import";

export const IMPORTED_FIRST_CONTACT_HOURS = 24;

/** Opções da importação ("Prazo para o primeiro contato"). */
export const IMPORTED_FIRST_CONTACT_OPTIONS = [4, 12, 24, 48, 72] as const;

export function isTeamListLead(sourceChannel: string | null | undefined) {
  return sourceChannel === TEAM_LIST_SOURCE_CHANNEL;
}

/** Lê o prazo gravado na importação; qualquer valor fora das opções volta para 24 h. */
export function importedFirstContactHours(metadata: unknown): number {
  const raw = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).firstContactHours : null;
  const hours = typeof raw === "string" ? Number(raw) : raw;
  return typeof hours === "number" && (IMPORTED_FIRST_CONTACT_OPTIONS as readonly number[]).includes(hours) ? hours : IMPORTED_FIRST_CONTACT_HOURS;
}

/** Normaliza o prazo escolhido pelo supervisor na tela (o servidor nunca confia no que veio). */
export function cleanFirstContactHours(value: unknown): number {
  return importedFirstContactHours({ firstContactHours: value });
}

/** Quando o lead importado vira pendência: entrega ao corretor + prazo. Null sem data de entrega. */
export function importedFirstContactDueAt(assignedAt: Date | null | undefined, hours: number = IMPORTED_FIRST_CONTACT_HOURS): Date | null {
  if (!assignedAt) return null;
  return new Date(assignedAt.getTime() + hours * 3_600_000);
}

/**
 * A regra de pendência do lead importado: dentro do prazo não é pendência; depois do prazo, sem contato, é.
 * Contato = primeiro contato registrado (data, mensagem do corretor ou etapa que andou).
 */
export function isImportedLeadPending(input: { assignedAt: Date | null; contacted: boolean; hours?: number; now: Date }) {
  if (input.contacted) return false;
  const dueAt = importedFirstContactDueAt(input.assignedAt, input.hours);
  return Boolean(dueAt && dueAt.getTime() <= input.now.getTime());
}

export function firstContactHoursLabel(hours: number) {
  return hours % 24 === 0 && hours >= 24 ? `${hours / 24} ${hours === 24 ? "dia" : "dias"}` : `${hours} h`;
}

export type ExpiredBatchLead = { brokerId: string; assignedAt: Date; hours: number; contacted: boolean };

/**
 * Leads importados que acabaram de passar do prazo, agrupados por corretor e por entrega (a Distribuição grava o
 * mesmo `assignedAt` para o lote inteiro). Um aviso por grupo: nunca um som por lead.
 */
export function groupExpiredImportBatches(leads: ExpiredBatchLead[], now: Date) {
  const groups = new Map<string, { brokerId: string; assignedAt: Date; count: number }>();
  for (const lead of leads) {
    if (!isImportedLeadPending({ assignedAt: lead.assignedAt, contacted: lead.contacted, hours: lead.hours, now })) continue;
    const key = `${lead.brokerId}:${lead.assignedAt.getTime()}`;
    const group = groups.get(key) ?? { brokerId: lead.brokerId, assignedAt: lead.assignedAt, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}
