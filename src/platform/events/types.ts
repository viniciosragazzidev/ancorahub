export type DomainEventMap = {
  "lead.created": { tenantId: string; leadId: string; occurredAt: string; version: 1 };
  "lead.assigned": { tenantId: string; leadId: string; brokerId: string; occurredAt: string; version: 1 };
  "lead.converted": { tenantId: string; leadId: string; saleId: string; occurredAt: string; version: 1 };
  "commission.paid": { tenantId: string; scheduleId: string; actorId: string; occurredAt: string; version: 1 };
  "team.member_created": { tenantId: string; membershipId: string; occurredAt: string; version: 1 };
  "team.member_updated": { tenantId: string; membershipId: string; occurredAt: string; version: 1 };
};

export type DomainEventName = keyof DomainEventMap;

export type DomainEvent<Name extends DomainEventName = DomainEventName> = {
  name: Name;
  payload: DomainEventMap[Name];
};
