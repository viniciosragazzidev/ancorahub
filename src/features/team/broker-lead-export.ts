import { leadStatusLabel, sourceLabel, temperatureLabel } from "@/features/reports/pdf/lead-quality-report-labels";
import type { TenantRole } from "@/shared/db/schema";

export const BROKER_LEAD_EXPORT_COLUMNS = [
  "Nome",
  "Telefone",
  "E-mail",
  "Tipo",
  "Origem/campanha",
  "Fila",
  "Unidade",
  "Status/etapa",
  "Temperatura/qualificação",
  "Valor mensal",
  "Vidas",
  "Data de chegada",
  "Data de atribuição ao corretor",
  "Último contato",
  "Motivo de perda",
  "Resumo da IA",
  "Link do lead no CRM",
] as const;

export function canExportBrokerLeadsByPermission(input: {
  role: TenantRole;
  canExportOperationalReports: boolean;
  canAccessLeads: boolean;
}) {
  return (input.role === "director" || input.role === "manager")
    && (input.canExportOperationalReports || input.canAccessLeads);
}

export function canExportBrokerMember(input: {
  viewerRole: TenantRole;
  viewerBranchId: string | null;
  memberRole: TenantRole;
  memberBranchId: string | null;
}) {
  if (input.memberRole !== "broker") return false;
  if (input.viewerRole === "director") return true;
  return input.viewerRole === "manager"
    && input.viewerBranchId !== null
    && input.viewerBranchId === input.memberBranchId;
}

export function buildBrokerLeadExportScope(input: {
  tenantId: string;
  brokerId: string;
  viewerRole: TenantRole;
  viewerBranchId: string | null;
  includeClosed: boolean;
}) {
  return {
    tenantId: input.tenantId,
    currentOwnerId: input.brokerId,
    branchId: input.viewerRole === "manager" ? input.viewerBranchId : null,
    excludeDeleted: true as const,
    excludedStatuses: input.includeClosed ? [] : ["converted", "lost"] as const,
  };
}

export type BrokerLeadExportSource = {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  tipo: string;
  origem: string;
  sourceChannel: string;
  sourceCampaign: string | null;
  queueName: string | null;
  branchName: string | null;
  status: string;
  qualificationStatus: string | null;
  monthlyValue: string | number | null;
  livesCount: number | null;
  createdAt: Date;
  assignedAt: Date | null;
  /** Raw sql subquery: postgres-js returns it as a string, not a Date. */
  latestInteractionAt: Date | string | null;
  firstContactAt: Date | null;
  motivoPerda: string | null;
  qualificationSummary: string | null;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dateLabel(value: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateTime.format(date);
}

function typeLabel(value: string) {
  if (value.toLocaleUpperCase("pt-BR") === "PF") return "Pessoa física";
  if (value.toLocaleUpperCase("pt-BR") === "PJ") return "Pessoa jurídica";
  return value;
}

export function buildBrokerLeadExportRow(lead: BrokerLeadExportSource, crmBaseUrl: string): Record<string, unknown> {
  const origin = sourceLabel(lead.sourceChannel || lead.origem);
  const originAndCampaign = [origin, lead.sourceCampaign]
    .filter(Boolean)
    .join(" · ");
  const lastContact = lead.latestInteractionAt ?? lead.firstContactAt;

  return {
    "Nome": lead.nome,
    "Telefone": lead.telefone,
    "E-mail": lead.email ?? "",
    "Tipo": typeLabel(lead.tipo),
    "Origem/campanha": originAndCampaign,
    "Fila": lead.queueName ?? "",
    "Unidade": lead.branchName ?? "",
    "Status/etapa": leadStatusLabel(lead.status),
    "Temperatura/qualificação": temperatureLabel(lead.qualificationStatus),
    "Valor mensal": lead.monthlyValue == null ? "" : currency.format(Number(lead.monthlyValue)),
    "Vidas": lead.livesCount ?? "",
    "Data de chegada": dateLabel(lead.createdAt),
    "Data de atribuição ao corretor": dateLabel(lead.assignedAt),
    "Último contato": dateLabel(lastContact),
    "Motivo de perda": lead.motivoPerda ?? "",
    "Resumo da IA": lead.qualificationSummary ?? "",
    "Link do lead no CRM": new URL(`/leads/${encodeURIComponent(lead.id)}`, crmBaseUrl).toString(),
  };
}

export function buildBrokerLeadsFilename(brokerName: string, date = new Date()) {
  const slug = brokerName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "corretor";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
  return `leads-${slug}-${day}.csv`;
}
