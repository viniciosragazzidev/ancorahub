import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";

import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { maskPersonalData } from "@/features/ai-gateway/privacy";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getSystemSetting } from "@/features/system-settings/queries";
import {
  ageOnDate,
  canViewSaleDetails,
  extractCpfFromMessages,
  extractCpfFromSources,
  hasConfirmedSaleEvidence,
  maskCpf,
  SaleDetailsStoredSchema,
  shouldShowSaleDetailsCard,
} from "@/features/leads/sale-details-core";

export type SaleDetailsCardField = {
  key: string;
  label: string;
  value: string;
  source: string | null;
};

export type SaleDetailsCardEvidence = {
  id: string;
  quote: string;
  at: string | null;
  sender: string | null;
  fieldLabel: string;
};

export type SaleDetailsCardAttachment = {
  id: string;
  filename: string;
  at: string;
  source: "Conversa" | "Cadastro CRM";
  href: string;
};

export type SaleDetailsCardPayload = {
  fields: SaleDetailsCardField[];
  milestones: SaleDetailsCardField[];
  evidence: SaleDetailsCardEvidence[];
  attachments: SaleDetailsCardAttachment[];
  copyText: string;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = String(value).replace(/\s+/g, " ").trim();
  return result || null;
}

function firstText(...values: unknown[]) {
  return values.map(text).find((value) => value !== null) ?? null;
}

function aiField(fields: ReturnType<typeof SaleDetailsStoredSchema.parse>["fields"], key: string) {
  return fields.find((field) => field.field === key) ?? null;
}

function aiSource(field: ReturnType<typeof SaleDetailsStoredSchema.parse>["fields"][number] | null) {
  if (!field) return null;
  if (field.source === "IA" || field.requiresConfirmation) return "IA (a confirmar)";
  return field.source ?? "Conversa";
}

function formatDatePt(value: Date | string | null | undefined, withTime = false) {
  if (!value) return "Não informado";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    ...(withTime ? { timeStyle: "short" as const } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function relationshipLabel(value: string) {
  const labels: Record<string, string> = {
    titular: "Titular",
    conjuge: "Cônjuge",
    filho: "Filho(a)",
    pai_mae: "Pai ou mãe",
    neto: "Neto(a)",
    outro: "Dependente",
  };
  return labels[value] ?? "Dependente";
}

export async function getSaleDetailsCard(leadId: string): Promise<SaleDetailsCardPayload | null> {
  if ((await getSystemSetting(FEATURE_FLAGS.CONVERSATION_INTELLIGENCE.key)) === "false") return null;
  const context = await getRequiredTenantContext();
  if (!(context.role === "director" || context.role === "manager" || context.role === "broker")) return null;
  if (!(await hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "acessar_leads",
  }))) return null;
  if (context.role === "manager" && !context.branchId) return null;

  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    tenantId: schema.leads.tenantId,
    branchId: schema.leads.branchId,
    corretorId: schema.leads.corretorId,
    nome: schema.leads.nome,
    status: schema.leads.status,
    createdAt: schema.leads.createdAt,
    qualificationDetails: schema.leads.qualificationDetails,
    formData: schema.leads.formData,
    monthlyValue: schema.leads.monthlyValue,
    livesCount: schema.leads.livesCount,
    planId: schema.leads.planId,
    brokerName: schema.user.name,
    leadPlanName: schema.carrierPlans.name,
    leadOperatorName: schema.carriers.name,
  }).from(schema.leads)
    .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.tenantId, schema.leads.tenantId), eq(schema.tenantMemberships.userId, schema.leads.corretorId)))
    .leftJoin(schema.user, and(eq(schema.user.id, schema.leads.corretorId), eq(schema.user.id, schema.tenantMemberships.userId)))
    .leftJoin(schema.carrierPlans, and(eq(schema.carrierPlans.id, schema.leads.planId), eq(schema.carrierPlans.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.carriers, and(eq(schema.carriers.id, schema.carrierPlans.carrierId), eq(schema.carriers.tenantId, schema.leads.tenantId)))
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, context.tenantId),
      isNull(schema.leads.deletedAt),
      buildLeadScopeWhere(context),
    )).limit(1);

  if (!lead || !canViewSaleDetails({
    role: context.role,
    userId: context.userId,
    branchId: context.branchId ?? null,
    leadBranchId: lead.branchId,
    leadOwnerId: lead.corretorId,
  })) return null;

  const qualification = record(lead.qualificationDetails);
  const form = record(lead.formData);
  const intelligence = record(qualification.aiIntelligence);
  const storedSaleDetails = SaleDetailsStoredSchema.safeParse(record(intelligence.saleDetails));
  const storedFields = storedSaleDetails.success ? storedSaleDetails.data.fields.map((field) => ({
    ...field,
    value: maskPersonalData(field.value),
    evidenceQuote: field.evidenceQuote ? maskPersonalData(field.evidenceQuote) : undefined,
  })) : [];
  const hasSaleEvidence = hasConfirmedSaleEvidence(record(qualification.aiSaleDetected).status)
    || lead.status === "converted";
  if (!shouldShowSaleDetailsCard(lead.status, hasSaleEvidence)) return null;

  const [beneficiaries, [sale], [proposal], stages, chatMedia, conversationMessages, leadDocuments] = await Promise.all([
    db.select({
      id: schema.leadBeneficiaries.id,
      name: schema.leadBeneficiaries.name,
      birthDate: schema.leadBeneficiaries.birthDate,
      relationship: schema.leadBeneficiaries.relationship,
      isHolder: schema.leadBeneficiaries.isHolder,
    }).from(schema.leadBeneficiaries)
      .where(and(eq(schema.leadBeneficiaries.tenantId, context.tenantId), eq(schema.leadBeneficiaries.leadId, lead.id)))
      .orderBy(desc(schema.leadBeneficiaries.isHolder), asc(schema.leadBeneficiaries.createdAt)),
    db.select({
      saleDate: schema.sales.saleDate,
      saleValue: schema.sales.saleValue,
      approvedValue: schema.sales.approvedValue,
      paymentMethod: schema.sales.paymentMethod,
      policyNumber: schema.sales.policyNumber,
      planName: schema.carrierPlans.name,
      operatorName: schema.carriers.name,
    }).from(schema.sales)
      .leftJoin(schema.carrierPlans, and(eq(schema.carrierPlans.id, schema.sales.carrierPlanId), eq(schema.carrierPlans.tenantId, schema.sales.tenantId)))
      .leftJoin(schema.carriers, and(eq(schema.carriers.id, schema.carrierPlans.carrierId), eq(schema.carriers.tenantId, schema.sales.tenantId)))
      .where(and(eq(schema.sales.tenantId, context.tenantId), eq(schema.sales.leadId, lead.id), eq(schema.sales.status, "active")))
      .orderBy(desc(schema.sales.createdAt)).limit(1),
    db.select({ createdAt: schema.proposals.createdAt, totalMonthly: schema.proposals.totalMonthly, beneficiaryCount: schema.proposals.beneficiaryCount, title: schema.proposals.title })
      .from(schema.proposals)
      .where(and(eq(schema.proposals.tenantId, context.tenantId), eq(schema.proposals.leadId, lead.id)))
      .orderBy(desc(schema.proposals.createdAt)).limit(1),
    db.select({ toStatus: schema.leadStageHistory.toStatus, changedAt: schema.leadStageHistory.changedAt })
      .from(schema.leadStageHistory)
      .where(and(eq(schema.leadStageHistory.tenantId, context.tenantId), eq(schema.leadStageHistory.leadId, lead.id)))
      .orderBy(asc(schema.leadStageHistory.changedAt)),
    db.select({ id: schema.whatsappMessages.id, direction: schema.whatsappMessages.direction, senderRole: schema.whatsappMessages.senderRole, mediaFilename: schema.whatsappMessages.mediaFilename, mediaKind: schema.whatsappMessages.mediaKind, sentAt: schema.whatsappMessages.sentAt })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, lead.id), eq(schema.whatsappMessages.direction, "incoming"), isNotNull(schema.whatsappMessages.mediaStorageKey)))
      .orderBy(desc(schema.whatsappMessages.sentAt)).limit(30),
    db.select({ id: schema.whatsappMessages.id, body: schema.whatsappMessages.body, direction: schema.whatsappMessages.direction, senderRole: schema.whatsappMessages.senderRole, sentAt: schema.whatsappMessages.sentAt })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, lead.id)))
      .orderBy(asc(schema.whatsappMessages.sentAt)),
    db.select({ id: schema.leadDocuments.id, filename: schema.leadDocuments.filename, fileUrl: schema.leadDocuments.fileUrl, createdAt: schema.leadDocuments.createdAt })
      .from(schema.leadDocuments)
      .where(and(eq(schema.leadDocuments.tenantId, context.tenantId), eq(schema.leadDocuments.leadId, lead.id), isNull(schema.leadDocuments.deletedAt)))
      .orderBy(desc(schema.leadDocuments.createdAt)).limit(30),
  ]);

  const holder = beneficiaries.find((person) => person.isHolder) ?? beneficiaries[0] ?? null;
  const formCpf = extractCpfFromSources(form);
  const qualificationCpf = extractCpfFromSources(qualification);
  const conversationCpf = extractCpfFromMessages(conversationMessages.map((message) => ({ content: message.body })));
  const cpf = formCpf ?? qualificationCpf ?? conversationCpf ?? null;
  const cpfSource = formCpf ? "Formulário" : qualificationCpf ? "Qualificação" : conversationCpf ? "Conversa" : null;
  const visibleCpf = maskCpf(cpf, context.role === "director");
  const now = new Date();
  const birthDate = holder?.birthDate
    ?? firstText(qualification.birthDate, qualification.dataNascimento, form.birthDate, form.dataNascimento);
  const birthDateSource = holder ? "Cadastro CRM"
    : qualification.birthDate || qualification.dataNascimento ? "Qualificação"
    : form.birthDate || form.dataNascimento ? "Formulário"
    : aiSource(aiField(storedFields, "holderBirthDate"));
  const holderAge = birthDate ? ageOnDate(birthDate, now) : null;
  const ai = (key: string) => aiField(storedFields, key);
  const livesFromCrm = lead.livesCount ?? (Number(qualification.numberOfLives ?? qualification.qtdVidas ?? form.qtdVidas ?? form.vidas) || null);
  const livesCount = Number.isInteger(livesFromCrm) && Number(livesFromCrm) > 0
    ? String(livesFromCrm)
    : ai("livesCount")?.value ?? String(beneficiaries.length || "");
  const livesSource = lead.livesCount != null ? "CRM"
    : qualification.numberOfLives != null || qualification.qtdVidas != null ? "Qualificação"
    : form.qtdVidas != null || form.vidas != null ? "Formulário"
    : aiSource(ai("livesCount")) ?? (beneficiaries.length ? "Cadastro CRM" : null);
  const monthlyFromSale = sale?.approvedValue && Number(sale.approvedValue) > 0 ? sale.approvedValue : sale?.saleValue;
  const monthlyValue = firstText(monthlyFromSale, proposal?.totalMonthly, lead.monthlyValue, ai("monthlyValue")?.value);
  const monthlySource = monthlyFromSale != null ? "Venda registrada" : proposal?.totalMonthly != null ? "Proposta" : lead.monthlyValue != null ? "CRM" : aiSource(ai("monthlyValue"));
  const carrierName = firstText(sale?.operatorName, lead.leadOperatorName, qualification.operadora, qualification.operadoraDesejada, ai("operator")?.value);
  const carrierSource = sale?.operatorName ? "Venda registrada" : lead.leadOperatorName ? "CRM" : qualification.operadora || qualification.operadoraDesejada ? "Qualificação" : aiSource(ai("operator"));
  const planName = firstText(sale?.planName, lead.leadPlanName, qualification.planName, qualification.plano, ai("plan")?.value);
  const planSource = sale?.planName ? "Venda registrada" : lead.leadPlanName ? "CRM" : qualification.planName || qualification.plano ? "Qualificação" : aiSource(ai("plan"));
  const dependentList = beneficiaries.filter((person) => !person.isHolder).map((person) => {
    const age = ageOnDate(person.birthDate, now);
    return `${relationshipLabel(person.relationship)}: ${person.name}${age === null ? "" : ` (${age} anos) `}`.trim();
  });
  const beneficiaryAges = beneficiaries.map((person) => ageOnDate(person.birthDate, now)).filter((age): age is number => age !== null);
  const agesValue = beneficiaryAges.length
    ? beneficiaryAges.join(", ")
    : ai("dependentAges")?.value ?? firstText(qualification.individualAges, qualification.idades, form.idades);
  const fallbackDependentDetails = firstText(qualification.dependentDetails, qualification.beneficiaryRaw, form.dependentes);
  const dependentsValue = dependentList.length ? dependentList.join("; ") : ai("dependentDetails")?.value ?? fallbackDependentDetails;
  const dependentsSource = dependentList.length ? "Cadastro CRM"
    : qualification.dependentDetails || qualification.beneficiaryRaw ? "Qualificação"
    : form.dependentes ? "Formulário"
    : aiSource(ai("dependentDetails"));
  const agesSource = beneficiaryAges.length ? "Cadastro CRM"
    : qualification.individualAges || qualification.idades ? "Qualificação"
    : form.idades ? "Formulário"
    : aiSource(ai("dependentAges"));

  const fields = [
    { key: "holder", label: "Titular", value: holder?.name ?? lead.nome, source: holder ? "Cadastro CRM" : "CRM" },
    { key: "cpf", label: "CPF", value: visibleCpf ?? "Não informado", source: cpfSource },
    { key: "birthDate", label: "Nascimento", value: birthDate ? formatDatePt(birthDate) : ai("holderBirthDate")?.value ?? "Não informado", source: birthDate ? birthDateSource : aiSource(ai("holderBirthDate")) },
    { key: "age", label: "Idade do titular", value: holderAge !== null ? `${holderAge} anos` : ai("holderAge")?.value ?? "Não informada", source: holderAge !== null ? birthDateSource : aiSource(ai("holderAge")) },
    { key: "lives", label: "Vidas", value: livesCount || "Não informado", source: livesCount ? livesSource : aiSource(ai("livesCount")) },
    { key: "dependents", label: "Dependentes", value: dependentsValue ?? "Não informados", source: dependentsSource },
    { key: "ages", label: "Idades", value: agesValue ?? "Não informadas", source: agesSource },
    { key: "operator", label: "Operadora", value: carrierName ?? "Não informada", source: carrierSource },
    { key: "plan", label: "Plano", value: planName ?? "Não informado", source: planSource },
    { key: "monthly", label: "Valor mensal", value: monthlyValue ? formatCurrencyOrText(monthlyValue) : "Não informado", source: monthlySource },
    { key: "enrollment", label: "Adesão", value: ai("enrollmentValue")?.value ?? "Não informada", source: aiSource(ai("enrollmentValue")) },
    { key: "firstInstallment", label: "1ª parcela", value: ai("firstInstallmentValue")?.value ?? "Não informada", source: aiSource(ai("firstInstallmentValue")) },
    { key: "paymentMethod", label: "Forma de pagamento", value: text(sale?.paymentMethod) ?? ai("paymentMethod")?.value ?? "Não informada", source: sale?.paymentMethod ? "Venda registrada" : aiSource(ai("paymentMethod")) },
    { key: "paymentDate", label: "Data do pagamento", value: ai("paymentDate")?.value ?? "Não informada", source: aiSource(ai("paymentDate")) },
    { key: "proposalNumber", label: "Nº da proposta / apólice", value: sale?.policyNumber ?? ai("proposalNumber")?.value ?? "Não informado", source: sale?.policyNumber ? "Venda registrada" : aiSource(ai("proposalNumber")) },
    { key: "interviewDate", label: "Entrevista médica", value: ai("medicalInterviewDate")?.value ?? "Não informada", source: aiSource(ai("medicalInterviewDate")) },
    { key: "broker", label: "Corretor", value: lead.brokerName ?? "Sem corretor", source: "CRM" },
  ].map((field) => ({
    ...field,
    value: field.key === "cpf" ? field.value : maskPersonalData(field.value),
  }));

  const stageDate = (status: string) => stages.find((stage) => stage.toStatus === status)?.changedAt ?? null;
  const closingDate = stages.find((stage) => stage.toStatus === "documentation_pending" || stage.toStatus === "under_analysis")?.changedAt ?? null;
  const detectedAt = record(qualification.aiSaleDetected).at;
  const convertedDate = stageDate("converted") ?? (typeof detectedAt === "string" ? detectedAt : null);
  const milestones = [
    { key: "quote", label: "Cotação", value: proposal?.createdAt ? formatDatePt(proposal.createdAt) : "Não registrada", source: proposal?.createdAt ? "Proposta" : null },
    { key: "negotiation", label: "Negociação", value: stageDate("negotiation") ? formatDatePt(stageDate("negotiation")) : "Não registrada", source: stageDate("negotiation") ? "Histórico do funil" : null },
    { key: "closing", label: "Fechamento", value: closingDate ? formatDatePt(closingDate) : "Não registrado", source: closingDate ? "Histórico do funil" : null },
    { key: "sale", label: "Venda", value: sale?.saleDate ? formatDatePt(sale.saleDate) : convertedDate ? formatDatePt(convertedDate) : "Não registrada", source: sale?.saleDate ? "Venda registrada" : convertedDate ? "Histórico do funil / IA" : null },
  ];

  const extractedEvidence: SaleDetailsCardEvidence[] = storedFields.flatMap((field) => field.evidenceQuote ? [{
    id: field.evidenceMessageId ?? `${field.field}:${field.evidenceAt ?? field.evidenceQuote}`,
    quote: maskPersonalData(field.evidenceQuote),
    at: field.evidenceAt ?? null,
    sender: field.evidenceSender ?? null,
    fieldLabel: saleFieldLabel(field.field),
  }] : []);
  const oldEvidence = [
    ...readStringArray(record(intelligence.saleCompleted).evidence),
    ...readStringArray(record(qualification.aiSaleDetected).evidence),
    ...readStringArray(record(qualification.aiSaleEvidence).paymentEvidence),
  ];
  for (const [index, raw] of oldEvidence.entries()) {
    const prefix = /^(Cliente|Corretor):\s*/.exec(raw);
    const sender = prefix?.[1] ?? null;
    const quote = maskPersonalData(raw.replace(/^(Cliente|Corretor):\s*/, "").trim());
    if (!quote) continue;
    const match = conversationMessages.find((message) => maskPersonalData(message.body).includes(quote));
    extractedEvidence.push({
      id: match?.id ?? `sale-proof:${index}:${quote}`,
      quote,
      at: match?.sentAt.toISOString() ?? null,
      sender: sender ?? (match ? match.direction === "incoming" ? "Cliente" : match.senderRole === "assistant" ? "Sistema" : "Corretor" : null),
      fieldLabel: "Evidência da venda",
    });
  }
  const evidence = [...new Map(extractedEvidence.map((item) => [`${item.id}:${item.quote}`, item])).values()];
  const attachments: SaleDetailsCardAttachment[] = [
    ...chatMedia.map((media) => ({
      id: `chat:${media.id}`,
      filename: maskPersonalData(media.mediaFilename ?? (media.mediaKind ? `Arquivo ${media.mediaKind}` : "Arquivo da conversa")),
      at: media.sentAt.toISOString(),
      source: "Conversa" as const,
      href: `/api/conversations/media/${encodeURIComponent(media.id)}`,
    })),
    ...leadDocuments.flatMap((document) => document.fileUrl.startsWith("/api/documents/download?") ? [{
      id: `document:${document.id}`,
      filename: maskPersonalData(document.filename),
      at: document.createdAt.toISOString(),
      source: "Cadastro CRM" as const,
      href: document.fileUrl,
    }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const copyText = [
    "Dados da venda",
    ...fields.map((field) => `${field.label}: ${field.value}${field.source ? ` (Fonte: ${field.source})` : ""}`),
    "Marcos",
    ...milestones.map((field) => `${field.label}: ${field.value}${field.source ? ` (Fonte: ${field.source})` : ""}`),
    "Evidências",
    ...evidence.map((item) => `${item.fieldLabel}: ${item.sender ? `${item.sender}: ` : ""}${item.quote}${item.at ? ` (${formatDatePt(item.at, true)})` : ""}`),
    "Arquivos",
    ...attachments.map((attachment) => `${attachment.filename}: ${attachment.href}${attachment.source === "Conversa" ? ` (Recebido em ${formatDatePt(attachment.at, true)})` : ` (Cadastro em ${formatDatePt(attachment.at, true)})`}`),
  ].join("\n");

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "lead",
    entidadeId: lead.id,
    acao: "lead.sale_details_viewed",
    metadata: { source: "lead_detail", cpfRevealed: context.role === "director" },
    createdAt: new Date(),
  });

  return { fields, milestones, evidence, attachments, copyText };
}

function formatCurrencyOrText(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number)
    : value;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 10) : [];
}

function saleFieldLabel(field: string) {
  const labels: Record<string, string> = {
    holderBirthDate: "Nascimento do titular",
    holderAge: "Idade do titular",
    livesCount: "Vidas",
    dependentAges: "Idades",
    dependentDetails: "Dependentes",
    operator: "Operadora",
    plan: "Plano",
    monthlyValue: "Valor mensal",
    enrollmentValue: "Adesão",
    firstInstallmentValue: "1ª parcela",
    paymentMethod: "Forma de pagamento",
    paymentDate: "Data do pagamento",
    proposalNumber: "Nº da proposta",
    medicalInterviewDate: "Entrevista médica",
  };
  return labels[field] ?? "Dado da venda";
}
