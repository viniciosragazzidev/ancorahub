import type { BrokerClientWalletFilters } from "./broker-client-wallet";

export function serializeBrokerClientWalletFilters(filters: BrokerClientWalletFilters) {
  const params = new URLSearchParams();
  params.set("view", filters.view);
  params.set("page", String(filters.page));
  if (filters.query) params.set("q", filters.query);
  if (filters.origin) params.set("origin", filters.origin);
  if (filters.contractStatus) params.set("contract", filters.contractStatus);
  if (filters.returnStatus) params.set("return", filters.returnStatus);
  return params.toString();
}
