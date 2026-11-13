import { ENTRY_STATUSES, ENTRY_STATUS_LABELS } from "../shared";

/** Status filter options of the ledger screens (server pages import this; it holds no client code). */
export const ENTRY_STATUS_OPTIONS = [
  { value: "all", label: "Todos os estados" },
  ...ENTRY_STATUSES.map((value) => ({ value, label: ENTRY_STATUS_LABELS[value] })),
];
