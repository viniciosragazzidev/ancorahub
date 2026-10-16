import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { getLeadDocuments, getRequirementsForLead } from "@/features/documents/actions";
import { buildLeadClientInfo } from "@/features/leads/client-info";
import { redactClientInfo } from "@/features/broker-workspace/lead-contact-privacy";
import { readMetaLeadDisplayDetails } from "@/features/leads/meta-lead-display";
import { buildConversationLeadScope } from "@/features/conversations/lead-scope";
import { getTeamConversation } from "@/features/team-conversations/queries";
import { getSupervisorLiteWhatsAppStatus } from "@/features/supervisor-workspace/lite-queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import type { LightLeadDetailData, LiteRequirement, ConfirmationDocument } from "@/features/broker-workspace/components/light-lead-detail/types";
import type { TeamConversationDetail } from "@/features/team-conversations/types";

export type TeamLeadPresentationFields = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  qualificationStatus: string | null;
  qualificationState: string | null;
  qualificationDetails: unknown;
  formData: unknown;
  consentimentoLgpd: boolean | null;
  tipo: string | null;
  origem: string | null;
  sourceCampaign: string | null;
  sourceChannel: string | null;
  sourceMetadata: unknown;
  createdAt: Date;
  assignedAt: Date | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerImage: string | null;
  branchName: string | null;
  planName: string | null;
};

type Beneficiary = {
  id: string;
  name: string;
  birthDate: string;
  relationship: string;
  isHolder: boolean;
};

export type TeamLeadPresentationSupplements = {
  conversation: TeamConversationDetail;
  brokerWhatsAppConnected: boolean;
  requirements: LiteRequirement[];
  documents: ConfirmationDocument[];
  beneficiaries: Beneficiary[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readFormData(value: unknown): Record<string, string | null> {
  const data = asRecord(value);
  return Object.fromEntries(["dependentes", "mediaIdades", "razaoSocial", "cnpj", "funcionarios", "cidade", "city"].map((key) => [key, readText(data[key])]));
}

export function buildTeamLeadLightDetail(lead: TeamLeadPresentationFields, beneficiaries: Beneficiary[]): LightLeadDetailData {
  const details = asRecord(lead.qualificationDetails);
  const formData = readFormData(lead.formData);
  const clientInfo = buildLeadClientInfo({
    email: null,
    tipo: lead.tipo,
    sourceChannel: lead.sourceChannel,
    sourceMetadata: lead.sourceMetadata,
    qualificationDetails: lead.qualificationDetails,
    formData: lead.formData,
  });
  const metaDetails = readMetaLeadDisplayDetails(lead.sourceChannel, lead.sourceMetadata);
  const lives = details.numberOfLives ?? details.qtdVidas ?? formData.dependentes;

  return {
    id: lead.id,
    nome: lead.name ?? "Lead",
    telefone: null,
    email: null,
    status: lead.status,
    qualificationStatus: lead.qualificationStatus,
    qualificationState: lead.qualificationState,
    corretorId: lead.ownerId,
    corretorNome: lead.ownerName,
    branchName: lead.branchName,
    planName: lead.planName,
    summary: readText(details.resumoAtendimento) ?? readText(details.resumoNecessidade),
    livesCount: lives === null || lives === undefined ? null : Number(lives) || null,
    urgency: readText(details.urgenciaContratacao),
    city: readText(details.city) ?? readText(formData.cidade),
    createdAt: lead.createdAt,
    assignedAt: lead.assignedAt,
    isCurrentBroker: false,
    tipo: lead.tipo,
    origem: lead.origem,
    sourceCampaign: lead.sourceCampaign,
    tipoCnpj: metaDetails.tipoCnpj,
    beneficiaries,
    formData,
    consentimentoLgpd: lead.consentimentoLgpd ?? false,
    aiIntelligence: details.aiIntelligence ?? null,
    aiPolicyResult: details.aiPolicyResult ?? null,
    clientInfo: redactClientInfo(clientInfo),
  };
}

/** Rechecks role scope before loading any team data associated with a lead id. */
export async function getTeamLeadPresentationSupplements(context: TenantContext, leadId: string, brokerId: string | null): Promise<TeamLeadPresentationSupplements | null> {
  if (context.role !== "manager" && context.role !== "supervisor") return null;

  const conversation = await getTeamConversation(context, leadId);
  if (!conversation) return null;

  const db = getDatabase();
  const [requirements, documents, beneficiaries, brokerWhatsAppStatus] = await Promise.all([
    getRequirementsForLead(leadId),
    getLeadDocuments(leadId),
    db.select({
      id: schema.leadBeneficiaries.id,
      name: schema.leadBeneficiaries.name,
      birthDate: schema.leadBeneficiaries.birthDate,
      relationship: schema.leadBeneficiaries.relationship,
      isHolder: schema.leadBeneficiaries.isHolder,
    })
      .from(schema.leadBeneficiaries)
      .innerJoin(schema.leads, and(
        eq(schema.leads.id, schema.leadBeneficiaries.leadId),
        eq(schema.leads.tenantId, schema.leadBeneficiaries.tenantId),
      ))
      .where(and(
        eq(schema.leadBeneficiaries.tenantId, context.tenantId),
        eq(schema.leadBeneficiaries.leadId, leadId),
        buildConversationLeadScope(context),
      ))
      .orderBy(asc(schema.leadBeneficiaries.isHolder), asc(schema.leadBeneficiaries.name)),
    brokerId ? getSupervisorLiteWhatsAppStatus({ context, memberId: brokerId }) : Promise.resolve(null),
  ]);

  return {
    conversation,
    brokerWhatsAppConnected: brokerWhatsAppStatus?.connected === true,
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      name: requirement.name,
      description: requirement.description,
      required: Boolean(requirement.required),
      appliesPerBeneficiary: Boolean(requirement.appliesPerBeneficiary),
    })),
    documents: documents.map((document) => ({ id: document.id, filename: document.filename, status: document.status })),
    beneficiaries: beneficiaries.map((beneficiary) => ({ ...beneficiary, birthDate: String(beneficiary.birthDate) })),
  };
}
