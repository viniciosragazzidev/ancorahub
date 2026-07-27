import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

export type RequestContext = {
  requestId: string;
  tenantId?: string;
  userId?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
