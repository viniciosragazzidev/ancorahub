import { schema } from "@/shared/db";
import type { ColumnMap, SortMap } from "@/shared/data-table/drizzle-filters";

export type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  source: string;
  planType: string;
  lives: number;
  city: string | null;
  state: string | null;
  assignedBrokerName: string | null;
  branchName: string | null;
  qualificationStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const leadsColumnMap: ColumnMap<LeadRow> = {
  name: { column: schema.leads.nome },
  phone: { column: schema.leads.telefone },
  email: { column: schema.leads.email },
  status: { column: schema.leads.status },
  source: { column: schema.leads.origem },
  planType: { column: schema.leads.tipo },
  qualificationStatus: { column: schema.leads.qualificationStatus },
};

export const leadsSortMap: SortMap<LeadRow> = {
  name: { column: schema.leads.nome },
  status: { column: schema.leads.status },
  planType: { column: schema.leads.tipo },
  createdAt: { column: schema.leads.createdAt },
  updatedAt: { column: schema.leads.updatedAt },
};
