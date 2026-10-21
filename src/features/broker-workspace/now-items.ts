import type { HomeNowItem } from "@/components/chat/types";
import { formatBrokerArrival } from "./arrival";
import type { BrokerWorkspaceData } from "./queries";
import type { BrokerWorkspacePriority } from "./priority";

type PendingOffer = BrokerWorkspaceData["pendingOffers"][number];

/** Three explicit next steps for the broker, ordered by urgency and deduplicated by kind. */
export function buildBrokerNowItems(input: {
  pendingOffers: PendingOffer[];
  priorities: BrokerWorkspacePriority[];
  agenda: BrokerWorkspaceData["agenda"];
  now?: Date;
}): HomeNowItem[] {
  const now = input.now ?? new Date();
  const items: HomeNowItem[] = [];
  const pending = input.pendingOffers
    .filter((offer) => offer.expiresAt.getTime() > now.getTime())
    .sort((left, right) => left.expiresAt.getTime() - right.expiresAt.getTime())[0];

  if (pending) {
    const arrival = formatBrokerArrival(pending.offeredAt, now);
    items.push({
      id: `accept-${pending.leadId}`,
      title: pending.name,
      detail: [`Recebido ${arrival}`, pending.scheduleName ? `Plantão ${pending.scheduleName}` : "Plantão de origem"].join(" · "),
      actionLabel: "Aceitar e chamar",
      href: `/leads/${pending.leadId}`,
      acceptLeadId: pending.leadId,
      expiresAt: pending.expiresAt.toISOString(),
      tone: "urgent",
    });
  }

  const reply = input.priorities
    .filter((priority) => priority.kind === "awaiting_response")
    .sort((left, right) => right.referenceAt.getTime() - left.referenceAt.getTime())[0];
  if (reply) {
    items.push({
      id: `reply-${reply.leadId}`,
      title: reply.title,
      detail: "Cliente respondeu e aguarda sua mensagem.",
      actionLabel: "Responder",
      href: `/leads/${reply.leadId}`,
      tone: "waiting",
    });
  }

  const overdueReturn = input.agenda
    .filter((item) => item.dueAt && item.dueAt.getTime() <= now.getTime() && /retorn|follow[ -]?up/i.test(item.title))
    .sort((left, right) => (left.dueAt?.getTime() ?? 0) - (right.dueAt?.getTime() ?? 0))[0];
  if (overdueReturn) {
    items.push({
      id: `return-${overdueReturn.id}`,
      title: overdueReturn.leadName,
      detail: `${overdueReturn.title} está vencido.`,
      actionLabel: "Ver retorno",
      href: overdueReturn.href,
      tone: "warning",
    });
  }

  return items;
}
