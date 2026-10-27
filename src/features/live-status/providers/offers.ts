/**
 * Item 6 do plano: ofertas aguardando aceite e a primeira a expirar (lead_offers.expires_at, exato).
 * O corretor vê só as dele; supervisor a equipe; gestor a unidade; diretor a empresa.
 */
import type { LiveScope, LiveStatus } from "../types";

export type OffersAggregate = { total: number; firstExpiresAt: Date | null; firstOfferedAt: Date | null };

export function buildOffersStatus(input: { aggregate: OffersAggregate; now: Date; scope: Pick<LiveScope, "role"> }): LiveStatus {
  const { aggregate, now, scope } = input;
  const own = scope.role === "broker";
  const href = own ? "/minha-fila" : scope.role === "director" || scope.role === "manager" ? "/leads/distribuicao?view=plantao" : undefined;
  return {
    id: "ofertas",
    label: own ? "Suas ofertas aguardando aceite" : "Ofertas aguardando aceite",
    value: aggregate.total,
    emptyText: own ? "Nenhuma oferta esperando você" : "Nenhuma oferta aguardando aceite",
    severity: aggregate.total ? (own ? "atencao" : "info") : "ok",
    nextEvent: aggregate.total && aggregate.firstExpiresAt
      ? {
          at: aggregate.firstExpiresAt.toISOString(),
          label: aggregate.total === 1 ? "Expira" : "A primeira expira",
          windowStartAt: aggregate.firstOfferedAt?.toISOString(),
          dueLabel: "Expirou; o lead segue para o próximo",
        }
      : undefined,
    explanation: own
      ? "Aceite antes de expirar; depois o lead vai para o próximo da fila."
      : aggregate.total
        ? "Se o corretor não aceitar, o lead vai para o próximo da fila."
        : "Quando o robô oferece um lead, o corretor tem um tempo para aceitar.",
    action: href ? { href, label: own ? "Abrir" : "Ver plantão" } : undefined,
    generatedAt: now.toISOString(),
  };
}
