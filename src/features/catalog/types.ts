export type CarrierRecord = {
  id: string;
  tenantId: string;
  name: string;
  ansCode: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
  notes: string | null;
  planCount: number;
};

export type CarrierPlanRecord = {
  id: string;
  tenantId: string;
  carrierId: string;
  name: string;
  type: "individual" | "empresarial" | "familiar" | "pme";
  description: string | null;
  coverage: string | null;
  ansRegistration: string | null;
  maxEntryAge: number | null;
  details: unknown;
  active: boolean;
};

export type CatalogActionState = { success?: boolean; error?: string };
