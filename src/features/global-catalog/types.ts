export type CatalogSource = "global" | "tenant_private";

export type CatalogActionState = {
  success?: string;
  error?: string;
};

export type AvailableCatalogPlan = {
  source: CatalogSource;
  planId: string;
  carrierId: string;
  carrierName: string;
  planName: string;
  planType: "individual" | "empresarial" | "familiar" | "pme";
  coverage: string | null;
  maxEntryAge: number | null;
};
