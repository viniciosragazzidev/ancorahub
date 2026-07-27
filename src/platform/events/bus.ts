import type { DomainEvent, DomainEventMap, DomainEventName } from "./types";

export type EventHandler<Name extends DomainEventName> = (event: DomainEvent<Name>) => void | Promise<void>;
export type EventFailure = { event: DomainEventName; error: unknown };

export function createDomainEventBus() {
  const handlers = new Map<DomainEventName, Set<EventHandler<DomainEventName>>>();

  function subscribe<Name extends DomainEventName>(name: Name, handler: EventHandler<Name>) {
    const bucket = handlers.get(name) ?? new Set<EventHandler<DomainEventName>>();
    bucket.add(handler as EventHandler<DomainEventName>);
    handlers.set(name, bucket);
    return () => bucket.delete(handler as EventHandler<DomainEventName>);
  }

  async function publish<Name extends DomainEventName>(event: DomainEvent<Name>) {
    const failures: EventFailure[] = [];
    for (const handler of handlers.get(event.name) ?? []) {
      try {
        await handler(event as DomainEvent<DomainEventName>);
      } catch (error) {
        failures.push({ event: event.name, error });
      }
    }
    return { failures };
  }

  return { subscribe, publish };
}

export type DomainEventBus = ReturnType<typeof createDomainEventBus>;

export type EventPayload<Name extends DomainEventName> = DomainEventMap[Name];
