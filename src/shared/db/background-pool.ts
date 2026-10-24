import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Background work (Coolify jobs, webhooks and what they schedule with `after()`) runs on
 * its own small set of DB sockets (Fase 1 de performance, 24/10). Before, the four sockets
 * of the process were shared by every page, so a job holding them froze navigation for
 * everyone. Code inside `runInBackgroundPool` gets the background pool from getDatabase()
 * without any change in the domain code.
 */
const backgroundScope = new AsyncLocalStorage<true>();

export function runInBackgroundPool<T>(work: () => T): T {
  return backgroundScope.run(true, work);
}

export function isInBackgroundPool() {
  return backgroundScope.getStore() === true;
}

/** A route handler whose whole run (and its `after()` work) uses the background pool. */
export function backgroundRoute<Args extends unknown[], Result>(handler: (...args: Args) => Promise<Result>) {
  return (...args: Args) => runInBackgroundPool(() => handler(...args));
}
