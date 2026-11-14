import "server-only";

import { and, desc, eq } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { avatarPhoneKey } from "@/features/contact-avatars/service";
import { hasBrokerClientWalletRenewalAttention } from "@/features/customers/broker-client-wallet";
import { classifyNextAction, type NextActionView } from "@/features/carteira/proxima-acao-core";
import { loadOpenReturnForBroker } from "@/features/carteira/retorno-queries";
import { getLeadDocuments } from "@/features/documents/actions";
import { getLeadTimeline } from "@/features/leads/queries";
import { getLeadBeneficiaries } from "@/features/post-sale/queries";

import {
  brokerProfileCanAct,
  buildProfileSummary,
  buildProfileTimeline,
  profileOrigin,
  profileSituation,
  shouldUseBrokerClientProfile,
  type BrokerClientProfileData,
  type ProfileActiveCustomer,
  type ProfileHistory,
} from "./profile-core";

/** Cliente já lido pela página com `buildClientScopeWhere` (tenant e carteira da sessão). */
export type ScopedClient = {
  id: string;
  leadId: string;
  name: string;
  phone: string;
  email: string | null;
  convertedAt: Date;
  branchName: string | null;
  brokerName: string | null;
};

/** A chave do modo corretor (`feature_broker_navigation_reorg_enabled`) com o corretor do Lite. Falha lê o padrão. */
export async function brokerClientProfileOn(context: TenantContext, liteAudience: string | null): Promise<boolean> {
  if (context.role !== "broker" || liteAudience !== "broker") return false;
  const flag = await getFeatureFlag(FEATURE_FLAGS.BROKER_NAV_REORG).catch(() => FEATURE_FLAGS.BROKER_NAV_REORG.defaultValue);
  return shouldUseBrokerClientProfile({ role: context.role, liteAudience, navReorgOn: flag === "true" });
}

/** Foto só se já estiver no cache de fotos do WhatsApp; o perfil nunca dispara uma busca nova. */
async function cachedAvatarSrc(tenantId: string, leadId: string, phone: string | null): Promise<string | null> {
  const phoneKey = phone ? avatarPhoneKey(phone) : "";
  if (!phoneKey) return null;
  const [row] = await getDatabase()
    .select({ imageBase64: schema.contactAvatars.imageBase64 })
    .from(schema.contactAvatars)
    .where(and(eq(schema.contactAvatars.tenantId, tenantId), eq(schema.contactAvatars.phoneKey, phoneKey)))
    .limit(1);
  return row?.imageBase64 ? `/api/contacts/avatar?lead=${encodeURIComponent(leadId)}` : null;
}

/**
 * Dados do Perfil do cliente para o corretor. Cada leitura reaplica tenant e autorização (consultas do lead,
 * documentos e beneficiários conferem o dono na sessão). Uma parte que falha vira estado de erro na própria seção.
 */
export async function loadBrokerClientProfile(context: TenantContext, client: ScopedClient, now = new Date()): Promise<BrokerClientProfileData> {
  const db = getDatabase();
  const [lead, sales, activeCustomer, interactions, documents, beneficiaries, avatarSrc] = await Promise.all([
    db
      .select({ corretorId: schema.leads.corretorId, origem: schema.leads.origem, sourceChannel: schema.leads.sourceChannel })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, client.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => undefined),
    db
      .select({
        id: schema.sales.id,
        planName: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
        saleValue: schema.sales.saleValue,
        policyNumber: schema.sales.policyNumber,
        saleDate: schema.sales.saleDate,
        status: schema.sales.status,
        brokerName: schema.user.name,
      })
      .from(schema.sales)
      .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .leftJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
      .where(and(eq(schema.sales.tenantId, context.tenantId), eq(schema.sales.clientId, client.id)))
      .orderBy(desc(schema.sales.createdAt)),
    db
      .select({
        status: schema.activeCustomers.status,
        coverageStartDate: schema.activeCustomers.coverageStartDate,
        contractAnniversary: schema.activeCustomers.contractAnniversary,
        expirationDate: schema.activeCustomers.expirationDate,
        renewalStatus: schema.activeCustomers.renewalStatus,
        renewalWindowStartDate: schema.activeCustomers.renewalWindowStartDate,
        cancellationDate: schema.activeCustomers.cancellationDate,
        cancellationReason: schema.activeCustomers.cancellationReason,
        updatedAt: schema.activeCustomers.updatedAt,
      })
      .from(schema.activeCustomers)
      .where(and(eq(schema.activeCustomers.tenantId, context.tenantId), eq(schema.activeCustomers.clientId, client.id)))
      .orderBy(desc(schema.activeCustomers.updatedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getLeadTimeline(client.leadId).then((rows) => rows ?? ("forbidden" as const)).catch(() => "error" as const),
    getLeadDocuments(client.leadId).catch(() => []),
    getLeadBeneficiaries(client.leadId).catch(() => []),
    cachedAvatarSrc(context.tenantId, client.leadId, client.phone).catch(() => null),
  ]);

  const canAct = lead ? brokerProfileCanAct({ userId: context.userId, leadOwnerId: lead.corretorId }) : false;
  const readOnlyReason = lead === undefined
    ? "Não foi possível conferir a carteira agora. As ações voltam ao recarregar."
    : canAct ? null : "Este cliente não está mais na sua carteira. O perfil fica só para consulta.";

  // Próxima ação: a tarefa aberta do corretor neste lead. Falha vira `null` (o resumo mostra "Tentar de novo").
  let nextAction: NextActionView | null;
  if (!canAct) {
    nextAction = lead === undefined ? null : { state: "not_owner", taskId: null, title: null, dueAt: null, reason: "Este cliente não está mais na sua carteira." };
  } else {
    nextAction = await loadOpenReturnForBroker(context.tenantId, client.leadId, context.userId)
      .then((task) => classifyNextAction(task ? { id: task.id, title: task.title, dueAt: task.dueAt } : null, now))
      .catch(() => null);
  }

  const contract: ProfileActiveCustomer | null = activeCustomer
    ? {
      status: activeCustomer.status,
      coverageStartDate: activeCustomer.coverageStartDate,
      contractAnniversary: activeCustomer.contractAnniversary,
      expirationDate: activeCustomer.expirationDate,
      renewalStatus: activeCustomer.renewalStatus,
      cancellationDate: activeCustomer.cancellationDate,
      cancellationReason: activeCustomer.cancellationReason,
    }
    : null;
  const renewalAttention = activeCustomer ? hasBrokerClientWalletRenewalAttention(activeCustomer, now) : false;

  const history: ProfileHistory = interactions === "error"
    ? { status: "error" }
    : interactions === "forbidden"
      ? { status: "forbidden" }
      : { status: "ok", entries: buildProfileTimeline({ interactions, sales, activeCustomer: contract }) };
  const profileDocuments = documents.map((document) => ({ id: document.id, filename: document.filename, status: document.status, requirementName: document.requirementName }));

  return {
    client: {
      id: client.id,
      leadId: client.leadId,
      name: client.name,
      phone: client.phone || null,
      email: client.email,
      convertedAt: client.convertedAt.toISOString(),
      branchName: client.branchName,
      brokerName: client.brokerName,
    },
    avatarSrc,
    situation: profileSituation(contract),
    origin: profileOrigin(lead ?? null),
    canAct,
    readOnlyReason,
    history,
    sales,
    activeCustomer: contract,
    documents: profileDocuments,
    beneficiaries: beneficiaries.map((b) => ({ id: b.id, name: b.name, relationship: b.relationship, isHolder: b.isHolder })),
    summary: buildProfileSummary({
      timeline: history.status === "ok" ? history.entries : [],
      nextAction,
      sales,
      activeCustomer: contract,
      documents: profileDocuments,
      renewalAttention,
    }),
  };
}
