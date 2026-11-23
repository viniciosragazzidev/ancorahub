import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { upcomingShift } from "@/features/dashboard/welcome-rules";
import { getPublishedDutyScheduleIds, selectEffectiveDutyAssignments } from "@/features/lead-distribution/dated-duty-roster";
import { setBrokersAvailabilityAction } from "@/features/branches/actions";
import {
  releaseDutyPresenceAction,
  sendDutyPresenceInviteManuallyAction,
  setDutyAbsenceAction,
  setDutyAssignmentAttendanceModeAction,
  toggleDutyRosterPauseAction,
} from "@/features/lead-distribution/duty-actions";
import { resetDutyManualQueueAction, saveDutyManualQueueAction } from "@/features/lead-distribution/duty-queue-order-actions";
import { getDutyQueueOrderPreviews } from "@/features/lead-distribution/duty-queue-order-queries";
import {
  addBrokerToPublishedOccurrenceAction,
  getMonthlyDutyPlanAction,
  publishMonthlyDutyPlanAction,
  setMonthlyDutyDayExcludedAction,
  removeBrokerFromPublishedOccurrenceAction,
  updateMonthlyDutyDraftAction,
} from "@/features/lead-distribution/monthly-duty-actions";
import { createRosterAssignmentAction, removeRosterAssignmentAction } from "@/features/lead-distribution/roster-actions";
import { standaloneSeats } from "./seats";
import {
  createTeamUserAction,
  getPendingInvitesAction,
  resendInviteAction,
  revokeInviteAction,
  toggleTeamMemberStatusAction,
  transferLeadsAction,
  updateTeamMemberAction,
} from "@/app/(dashboard)/equipe/actions";
import { sendBrokerDirectMessageAction } from "@/features/broker-workspace/broker-template-actions";
import { returnConversationToAiAction, takeoverConversationAction } from "@/features/ai-agent/actions";
import { getQualificationAlerts } from "@/features/ai-qualification/alerts-service";
import { toggleAcceptingLeadsAction } from "@/features/branches/actions";
import { setUnitQueueModeAction } from "@/features/lead-distribution/queue-mode-actions";
import { sendLeadMessageAction } from "@/features/leads/actions/send-lead-message";
import { sendPlantaoReportNowAction } from "@/features/reports/plantao-report-actions";
import { saveHomeAnnouncementAction } from "@/features/home-announcement/actions";
import { getHomeAnnouncement } from "@/features/home-announcement/service";
import { bulkChangeLeadStatusAction } from "@/app/(dashboard)/leads/status-actions";
import { getBrokerWhatsAppStatusForContext } from "@/features/dashboard/today";
import { assignLeadToBrokerAction, distributeAllUnassignedLeadsAction } from "@/features/lead-distribution/actions";
import { addLeadNoteAction } from "@/features/leads/actions";
import { createLeadTaskAction } from "@/features/leads/task-actions";
import { assignDutyLeadToBrokerAction, getDutyAvailableLeadsAction } from "@/features/lead-distribution/duty-actions";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import { getLeadDutyReassignmentOptions, reassignLeadAction, removeLeadAssignmentAction, resendLeadToSameBrokerAction } from "@/features/leads/management-actions";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import type { AgentActionRecord, AgentBackend, DutyNow } from "./backend";
import type { LeadFilter, LeadSummary, Person, SeatOccurrence } from "./types";

/**
 * O backend real: cada método usa a consulta ou a ação que a tela já usa. As ações chamam
 * `getRequiredTenantContext()` sozinhas (mesma requisição da rota, mesmo cookie) e conferem permissão de novo.
 */
const NOT_PUBLISHED = "não está na escala publicada";

function monthKeysBetween(from: string, until: string) {
  const keys: string[] = [];
  // O mês anterior também: uma escala pode avançar no começo do mês seguinte.
  let cursor = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 2, 1));
  const last = until.slice(0, 7);
  while (cursor.toISOString().slice(0, 7) <= last && keys.length < 6) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return keys;
}

export function createServerAgentBackend(context: TenantContext): AgentBackend {
  const db = getDatabase();

  /**
   * Plantões rodando agora e, com `horizonHours`, os que começam nas próximas horas, com quem está escalado
   * (escala efetiva do dia, como no painel do diretor), presença do dia e pausas.
   */
  async function loadDuties(horizonHours: number): Promise<DutyNow[]> {
    const now = new Date();
    const schedules = await db
      .select({
        id: schema.unitDutySchedules.id,
        name: schema.unitDutySchedules.name,
        dayOfWeek: schema.unitDutySchedules.dayOfWeek,
        startsAt: schema.unitDutySchedules.startsAt,
        endsAt: schema.unitDutySchedules.endsAt,
        timezone: schema.unitDutySchedules.timezone,
        validFrom: schema.unitDutySchedules.validFrom,
        validUntil: schema.unitDutySchedules.validUntil,
        minimumBrokers: schema.unitDutySchedules.minimumBrokers,
        queueName: schema.leadQueues.name,
      })
      .from(schema.unitDutySchedules)
      .leftJoin(schema.leadQueues, eq(schema.leadQueues.id, schema.unitDutySchedules.queueId))
      .where(and(
        eq(schema.unitDutySchedules.tenantId, context.tenantId),
        eq(schema.unitDutySchedules.status, "active"),
        or(isNull(schema.unitDutySchedules.validUntil), gt(schema.unitDutySchedules.validUntil, now)),
      ));
    const limit = now.getTime() + horizonHours * 3_600_000;
    const windows = schedules.flatMap((schedule) => {
      const shift = upcomingShift(schedule, now, 2);
      return shift && (shift.running || shift.start.getTime() <= limit) ? [{ schedule, shift }] : [];
    });
    if (!windows.length) return [];
    const ids = windows.map((item) => item.schedule.id);
    const dates = [...new Set(windows.map((item) => item.shift.dutyDate))];
    const [assignments, publishedByDate, presence] = await Promise.all([
      db.select({
        id: schema.dutyRosterAssignments.id,
        scheduleId: schema.dutyRosterAssignments.scheduleId,
        brokerId: schema.dutyRosterAssignments.brokerId,
        dutyDate: schema.dutyRosterAssignments.dutyDate,
        pausedAt: schema.dutyRosterAssignments.pausedAt,
      })
        .from(schema.dutyRosterAssignments)
        .where(and(eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active"), inArray(schema.dutyRosterAssignments.scheduleId, ids))),
      Promise.all(dates.map(async (date) => [date, await getPublishedDutyScheduleIds(context.tenantId, date)] as const)).then((rows) => new Map(rows)),
      db.select({ scheduleId: schema.dutyPresenceConfirmations.scheduleId, brokerId: schema.dutyPresenceConfirmations.brokerId, dutyDate: schema.dutyPresenceConfirmations.dutyDate, status: schema.dutyPresenceConfirmations.status })
        .from(schema.dutyPresenceConfirmations)
        .where(and(eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId), inArray(schema.dutyPresenceConfirmations.scheduleId, ids), inArray(schema.dutyPresenceConfirmations.dutyDate, dates))),
    ]);
    const brokerIds = [...new Set(assignments.map((row) => row.brokerId))];
    const people = brokerIds.length
      ? await db.select({ id: schema.user.id, name: schema.user.name, availability: schema.tenantMemberships.availabilityStatus })
        .from(schema.user)
        .innerJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, context.tenantId)))
        .where(inArray(schema.user.id, brokerIds))
      : [];
    const person = new Map(people.map((row) => [row.id, row]));
    const rank = { confirmed: 4, absent: 3, pending: 2, expired: 1 } as Record<string, number>;
    const presenceOf = new Map<string, DutyNow["brokers"][number]["presence"]>();
    for (const row of presence) {
      const key = `${row.scheduleId}|${row.brokerId}|${String(row.dutyDate)}`;
      const current = presenceOf.get(key);
      if (!current || (rank[row.status] ?? 0) > (rank[current] ?? 0)) presenceOf.set(key, row.status as DutyNow["brokers"][number]["presence"]);
    }
    return windows.map(({ schedule, shift }) => {
      const rows = selectEffectiveDutyAssignments(assignments.filter((row) => row.scheduleId === schedule.id), shift.dutyDate, publishedByDate.get(shift.dutyDate) ?? null);
      const seen = new Set<string>();
      const brokers = rows.flatMap((row) => {
        if (seen.has(row.brokerId)) return [];
        seen.add(row.brokerId);
        const who = person.get(row.brokerId);
        return [{
          id: row.brokerId,
          assignmentId: row.id,
          name: who?.name?.trim() || "Corretor",
          presence: presenceOf.get(`${schedule.id}|${row.brokerId}|${shift.dutyDate}`) ?? "none",
          pausedHere: Boolean(row.pausedAt),
          pausedGlobal: who?.availability === "paused",
        }];
      }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      return {
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        dutyDate: shift.dutyDate,
        startsAt: schedule.startsAt,
        endsAt: schedule.endsAt,
        minimumBrokers: schedule.minimumBrokers,
        queueName: schedule.queueName,
        running: shift.running,
        brokers,
      };
    }).sort((a, b) => a.dutyDate.localeCompare(b.dutyDate) || a.startsAt.localeCompare(b.startsAt) || a.scheduleName.localeCompare(b.scheduleName, "pt-BR"));
  }

  const WAITING = ["queued", "unassigned", "returned_to_queue"];

  async function selectLeads(where: ReturnType<typeof and>, limit: number): Promise<LeadSummary[]> {
    const rows = await db
      .select({
        id: schema.leads.id,
        name: schema.leads.nome,
        status: schema.leads.status,
        brokerId: schema.leads.corretorId,
        brokerName: schema.user.name,
        queueName: schema.leadQueues.name,
        temperature: schema.leads.qualificationStatus,
        distributionStatus: schema.leads.distributionStatus,
        createdAt: schema.leads.createdAt,
        phone: schema.leads.telefone,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, context.tenantId)))
      .where(where)
      .orderBy(desc(schema.leads.createdAt))
      .limit(limit);
    return rows.map((row) => ({
      id: row.id,
      name: row.name?.trim() || "Lead sem nome",
      status: String(row.status),
      brokerId: row.brokerId,
      brokerName: row.brokerName?.trim() || null,
      queueName: row.queueName,
      temperature: ["hot", "warm", "cold"].includes(row.temperature ?? "") ? row.temperature : null,
      distributionStatus: row.distributionStatus,
      createdAt: row.createdAt.toISOString(),
      phoneTail: row.phone ? row.phone.replace(/\D/g, "").slice(-4) || null : null,
    }));
  }

  function formOf(values: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return form;
  }

  return {
    now: () => new Date(),

    async searchLeads(filter: LeadFilter) {
      const text = filter.text?.trim();
      const digits = text?.replace(/\D/g, "") ?? "";
      return selectLeads(and(
        buildLeadScopeWhere(context),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
        text ? (digits.length >= 4 ? sql`regexp_replace(${schema.leads.telefone}, '\\D', '', 'g') like ${`%${digits}%`}` : ilike(schema.leads.nome, `%${text}%`)) : undefined,
        filter.withoutBroker ? and(isNull(schema.leads.corretorId), inArray(schema.leads.distributionStatus, WAITING)) : undefined,
        filter.brokerId ? eq(schema.leads.corretorId, filter.brokerId) : undefined,
        filter.status ? eq(schema.leads.status, filter.status as typeof schema.leads.status.enumValues[number]) : undefined,
      ), Math.min(Math.max(filter.limit, 1), 50));
    },

    async leadById(leadId) {
      const [lead] = await selectLeads(and(buildLeadScopeWhere(context), eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt)), 1);
      return lead ?? null;
    },

    async dutyAvailableLeads(scheduleId) {
      const result = await getDutyAvailableLeadsAction(scheduleId);
      if (!result.ok) throw new Error(result.reason);
      return result.leads.map((lead) => ({
        id: lead.id,
        name: lead.name?.trim() || "Lead sem nome",
        status: "new",
        brokerId: null,
        brokerName: null,
        queueName: lead.queueName,
        temperature: lead.temperature,
        distributionStatus: "unassigned",
        createdAt: lead.createdAt,
        phoneTail: lead.phone ? lead.phone.replace(/\D/g, "").slice(-4) || null : null,
      }));
    },

    async assignDutyLead(scheduleId, brokerId, leadId) {
      const result = await assignDutyLeadToBrokerAction(scheduleId, brokerId, leadId);
      if (!result.ok) throw new Error(result.reason);
    },

    async giveLead(leadId, brokerId) {
      const [lead] = await db.select({ brokerId: schema.leads.corretorId }).from(schema.leads)
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
      if (!lead) throw new Error("Lead não encontrado.");
      if (!lead.brokerId) {
        const result = await assignLeadToBrokerAction({}, formOf({ leadId, brokerId, assignmentMode: "direct", reason: "Pelo Agente IA, a pedido do diretor" }));
        if (result.error) throw new Error(result.error);
        return;
      }
      // Fila com plantão ativo: a tela exige escolher o corretor dentro do plantão (dutyScheduleId).
      const options = await getLeadDutyReassignmentOptions(leadId);
      const inDuty = options.success && "brokers" in options ? (options.brokers as Array<{ id: string; scheduleId?: string }>).find((item) => item.id === brokerId) : undefined;
      const values: Record<string, string> = { leadId, brokerId };
      if (inDuty?.scheduleId) values.dutyScheduleId = inDuty.scheduleId;
      const result = await reassignLeadAction({}, formOf(values));
      if (result.error) throw new Error(result.error);
    },

    async transferPortfolio(fromId, toId) {
      const result = await transferLeadsAction({}, formOf({ fromUserId: fromId, toUserId: toId }));
      if (result.error) throw new Error(result.error);
      return result.message ?? "Carteira transferida.";
    },

    async resendOffer(leadId) {
      const result = await resendLeadToSameBrokerAction({}, formOf({ leadId }));
      if (result.error) throw new Error(result.error);
    },

    async changeStage(leadIds, status, lostReason) {
      const form = new FormData();
      for (const id of leadIds) form.append("leadIds", id);
      form.set("newStatus", status);
      if (lostReason) form.set("motivoPerda", lostReason);
      const result = await bulkChangeLeadStatusAction({}, form);
      if (result.error) throw new Error(result.error);
      return result.changedLeadIds ?? leadIds;
    },

    async addNote(leadId, text, clientMessageId) {
      const result = await addLeadNoteAction({}, formOf({ leadId, content: text, clientMessageId }));
      if (result.error) throw new Error(result.error);
    },

    async createTask(leadId, title, dueAt, assigneeIds) {
      const form = formOf({ leadId, title, priority: "normal", ...(dueAt ? { dueAt } : {}) });
      for (const id of assigneeIds) form.append("assigneeIds", id);
      const result = await createLeadTaskAction({}, form);
      if (result.error) throw new Error(result.error);
    },

    async distributeUnassigned() {
      const result = await distributeAllUnassignedLeadsAction();
      if (result.error) throw new Error(result.error);
      return result.message ?? "Distribuição iniciada.";
    },

    async whatsappDisconnected() {
      const status = await getBrokerWhatsAppStatusForContext(context);
      return status.notConnected.map((item) => item.id);
    },

    async listBranches() {
      const rows = await db.select({ id: schema.branches.id, name: schema.branches.name, status: schema.branches.status, acceptingLeads: schema.branches.acceptingLeads })
        .from(schema.branches).where(eq(schema.branches.tenantId, context.tenantId)).limit(200);
      return rows.map((row) => ({ id: row.id, name: row.name, active: String(row.status) === "active", acceptingLeads: Boolean(row.acceptingLeads) }));
    },

    async invite(input) {
      const result = await createTeamUserAction({}, formOf({
        name: input.name, phone: input.phone, email: input.email ?? "", branchId: input.branchId,
        role: "broker", jobTitle: "broker", ...(input.brokerCode ? { brokerCode: input.brokerCode } : {}),
      }));
      if (!result.success) throw new Error(result.error ?? "Não foi possível convidar.");
      return { invitationId: result.invitationId ?? null, whatsappStatus: result.whatsappStatus ?? null };
    },

    async pendingInvites() {
      const rows = await getPendingInvitesAction();
      return (rows as Array<{ id: string; email: string | null; status: string; expiresAt: Date | string | null; name?: string | null; professionalName?: string | null }>)
        .filter((row) => row.status === "PENDING")
        .map((row) => ({ id: row.id, name: row.name ?? row.professionalName ?? null, email: row.email, status: row.status, expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null }));
    },

    async resendInvite(invitationId) {
      const result = await resendInviteAction({}, formOf({ invitationId }));
      if (!result.success) throw new Error(result.error ?? "Não foi possível reenviar.");
    },

    async revokeInvite(invitationId) {
      const result = await revokeInviteAction({}, formOf({ invitationId }));
      if (!result.success) throw new Error(result.error ?? "Não foi possível revogar.");
    },

    async changeUnit(userId, branchId) {
      // A tela grava todos os campos de uma vez: manda os atuais e muda só a unidade (sem isso, o cargo some).
      const [member] = await db.select({
        membershipId: schema.tenantMemberships.id, name: schema.user.name, email: schema.user.email,
        role: schema.tenantMemberships.role, jobTitle: schema.tenantMemberships.jobTitle, customRoleId: schema.tenantMemberships.customRoleId,
      }).from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, userId))).limit(1);
      if (!member) throw new Error("Pessoa não encontrada.");
      const result = await updateTeamMemberAction({}, formOf({
        memberId: member.membershipId, name: member.name ?? "", email: member.email ?? "", role: String(member.role), jobTitle: member.jobTitle,
        branchId, customRoleId: member.customRoleId ?? "__none__",
      }));
      if (!result.success) throw new Error(result.error ?? "Não foi possível trocar a unidade.");
    },

    async setMemberActive(userId, active) {
      const [member] = await db.select({ membershipId: schema.tenantMemberships.id, status: schema.user.status })
        .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, userId))).limit(1);
      if (!member) throw new Error("Pessoa não encontrada.");
      const isActive = member.status === "active";
      if (isActive === active) return;
      const result = await toggleTeamMemberStatusAction({}, formOf({ memberId: member.membershipId }));
      if (!result.success) throw new Error(result.error ?? "Não foi possível mudar o acesso.");
    },

    async messageBroker(userId, body) {
      const [profile] = await db.select({ id: schema.brokerProfiles.id }).from(schema.brokerProfiles)
        .where(and(eq(schema.brokerProfiles.tenantId, context.tenantId), eq(schema.brokerProfiles.userId, userId))).limit(1);
      if (!profile) throw new Error("Corretor sem cadastro de corretor (perfil).");
      const result = await sendBrokerDirectMessageAction({ brokerProfileId: profile.id, body });
      if (!result.success) throw new Error(result.error ?? "Não foi possível enviar.");
    },

    async homeAnnouncement() {
      const current = await getHomeAnnouncement(context.tenantId);
      return current ? { active: current.active, title: current.title, body: current.body, endsOn: current.endsOn, art: current.art, tone: current.tone, button: current.button } : null;
    },

    async saveHomeAnnouncement(value) {
      const result = await saveHomeAnnouncementAction(value);
      if (!result.ok) throw new Error(result.error);
    },

    async conversationOfLead(leadId) {
      const [row] = await db.select({ id: schema.aiConversations.id, status: schema.aiConversations.status })
        .from(schema.aiConversations)
        .where(and(eq(schema.aiConversations.tenantId, context.tenantId), eq(schema.aiConversations.leadId, leadId)))
        .orderBy(desc(schema.aiConversations.updatedAt))
        .limit(1);
      return row ? { id: row.id, status: String(row.status) } : null;
    },

    async takeoverConversation(conversationId) {
      const result = await takeoverConversationAction(conversationId);
      if (!result.success) throw new Error(result.error ?? "Não foi possível assumir a conversa.");
    },

    async returnConversationToAi(conversationId) {
      const result = await returnConversationToAiAction(conversationId);
      if (!result.success) throw new Error(result.error ?? "Não foi possível devolver a conversa à IA.");
    },

    async sendClientMessage(leadId, body, clientMessageId) {
      const result = await sendLeadMessageAction(leadId, body, clientMessageId);
      if (!result.success) throw new Error(("error" in result && result.error) || "Não foi possível enviar a mensagem.");
    },

    async setBranchAcceptingLeads(branchId, accepting) {
      const [branch] = await db.select({ acceptingLeads: schema.branches.acceptingLeads }).from(schema.branches)
        .where(and(eq(schema.branches.id, branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1);
      if (!branch) throw new Error("Unidade não encontrada.");
      if (Boolean(branch.acceptingLeads) === accepting) return;
      const result = await toggleAcceptingLeadsAction({}, formOf({ branchId }));
      if (result.error) throw new Error(result.error);
    },

    async listQueues() {
      const rows = await db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name, branchName: schema.branches.name, mode: schema.leadQueues.assignmentMode, status: schema.leadQueues.status })
        .from(schema.leadQueues)
        .leftJoin(schema.branches, eq(schema.branches.id, schema.leadQueues.branchId))
        .where(and(eq(schema.leadQueues.tenantId, context.tenantId), isNull(schema.leadQueues.deletedAt)))
        .limit(200);
      return rows.map((row) => ({ id: row.id, name: row.name, branchName: row.branchName, mode: row.mode === "manual" ? "manual" as const : "automatic" as const, active: row.status === "active" }));
    },

    async setQueueMode(queueId, mode) {
      const result = await setUnitQueueModeAction({ queueId, mode });
      if (!result.ok) throw new Error(result.reason);
    },

    async qualificationAlerts() {
      const alerts = await getQualificationAlerts(context.tenantId);
      return alerts.map((alert) => ({ level: String(alert.level), message: alert.message }));
    },

    async sendPlantaoReport() {
      const result = await sendPlantaoReportNowAction();
      if (!result.ok) throw new Error(result.error);
      return result.message;
    },

    async unassignLead(leadId) {
      const result = await removeLeadAssignmentAction({}, formOf({ leadId }));
      if (result.error) throw new Error(result.error);
    },

    async listPeople(): Promise<Person[]> {
      const rows = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          role: schema.tenantMemberships.role,
          jobTitle: schema.tenantMemberships.jobTitle,
          status: schema.tenantMemberships.status,
          availability: schema.tenantMemberships.availabilityStatus,
          branchId: schema.tenantMemberships.branchId,
          branchName: schema.branches.name,
          membershipId: schema.tenantMemberships.id,
          email: schema.user.email,
          customRoleId: schema.tenantMemberships.customRoleId,
        })
        .from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .leftJoin(schema.branches, and(eq(schema.branches.id, schema.tenantMemberships.branchId), eq(schema.branches.tenantId, context.tenantId)))
        .where(eq(schema.tenantMemberships.tenantId, context.tenantId))
        .limit(2000);
      return rows.map((row) => ({ ...row, name: row.name?.trim() || "Sem nome", status: String(row.status), availability: String(row.availability) }));
    },

    async listSeats({ from, until }) {
      const [views, types] = await Promise.all([
        Promise.all(monthKeysBetween(from, until).map((key) => getMonthlyDutyPlanAction(key).catch(() => null))),
        db.select({ id: schema.dutyScheduleTypes.id, name: schema.dutyScheduleTypes.name }).from(schema.dutyScheduleTypes).where(eq(schema.dutyScheduleTypes.tenantId, context.tenantId)),
      ]);
      const typeName = new Map(types.map((row) => [row.id, row.name]));
      const byId = new Map<string, SeatOccurrence>();
      for (const view of views) {
        if (!view) continue;
        const live = new Set(view.publishedOccurrenceIds);
        for (const occurrence of view.occurrences) {
          if (occurrence.dutyDate < from || occurrence.dutyDate > until) continue;
          const source = view.status === "published" || live.has(occurrence.id) ? "published" : "draft";
          const seat: SeatOccurrence = {
            id: occurrence.id,
            scheduleId: occurrence.scheduleId,
            scheduleName: occurrence.scheduleName,
            dutyDate: occurrence.dutyDate,
            startsAt: occurrence.startsAt,
            endsAt: occurrence.endsAt,
            typeId: occurrence.typeId ?? null,
            typeName: occurrence.typeId ? typeName.get(occurrence.typeId) ?? null : null,
            attendanceMode: occurrence.attendanceMode ?? null,
            maximumBrokers: occurrence.maximumBrokers,
            minimumBrokers: occurrence.minimumBrokers,
            brokerIds: occurrence.brokers.map((broker) => broker.id),
            allowedBrokerIds: occurrence.allowedBrokerIds,
            started: occurrence.started,
            ended: occurrence.ended,
            source,
            planId: view.id,
          };
          const previous = byId.get(seat.id);
          if (!previous || (previous.source === "draft" && seat.source === "published")) byId.set(seat.id, seat);
        }
      }
      // Plantões avulsos (um dia, fora da escala mensal): a escala mensal não os traz.
      const sp = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const part = (type: string) => sp.find((item) => item.type === type)?.value ?? "00";
      const spKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
      const [schedules, typeRows, roster, people] = await Promise.all([
        db.select().from(schema.unitDutySchedules).where(and(
          eq(schema.unitDutySchedules.tenantId, context.tenantId),
          eq(schema.unitDutySchedules.status, "active"),
          // Operadores do Drizzle convertem o Date; dentro de sql`` cru o driver recusa o Date
          // ("The string argument must be of type string") e o Passar para alguém quebrava.
          isNotNull(schema.unitDutySchedules.validUntil),
          gt(schema.unitDutySchedules.validUntil, new Date(`${from}T03:00:00Z`)),
          lte(schema.unitDutySchedules.validFrom, new Date(`${until}T23:59:59-03:00`)),
        )),
        db.select({ id: schema.dutyScheduleTypes.id, name: schema.dutyScheduleTypes.name, branchIds: schema.dutyScheduleTypes.branchIds }).from(schema.dutyScheduleTypes).where(eq(schema.dutyScheduleTypes.tenantId, context.tenantId)),
        db.select({ scheduleId: schema.dutyRosterAssignments.scheduleId, brokerId: schema.dutyRosterAssignments.brokerId, dayOfWeek: schema.dutyRosterAssignments.dayOfWeek })
          .from(schema.dutyRosterAssignments)
          .where(and(eq(schema.dutyRosterAssignments.tenantId, context.tenantId), eq(schema.dutyRosterAssignments.status, "active"), isNull(schema.dutyRosterAssignments.dutyDate))),
        this.listPeople(),
      ]);
      const typeById = new Map(typeRows.map((row) => [row.id, row]));
      const extra = standaloneSeats({
        schedules: schedules.map((row) => ({
          id: row.id,
          name: row.name,
          dayOfWeek: row.dayOfWeek,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          typeId: row.typeId ?? null,
          typeName: row.typeId ? typeById.get(row.typeId)?.name ?? null : null,
          typeBranchIds: row.typeId ? typeById.get(row.typeId)?.branchIds ?? [] : [],
          attendanceMode: (row.attendanceMode as "online" | "presencial" | null) ?? null,
          minimumBrokers: row.minimumBrokers,
          maximumBrokers: row.maximumBrokers ?? null,
          validFrom: spKey(row.validFrom),
          validUntil: row.validUntil ? spKey(row.validUntil) : null,
        })),
        roster,
        brokers: people.filter((person) => person.role === "broker" && person.status === "active").map((person) => ({ id: person.id, branchId: person.branchId ?? null })),
        coveredIds: new Set(byId.keys()),
        from,
        until,
        today: `${part("year")}-${part("month")}-${part("day")}`,
        nowTime: `${part("hour")}:${part("minute")}`,
      });
      return [...byId.values(), ...extra];
    },

    async dutyNow(): Promise<DutyNow[]> {
      return (await loadDuties(0)).filter((duty) => duty.running);
    },

    async dutySoon(): Promise<DutyNow[]> {
      return loadDuties(24);
    },

    async addSeat(occurrence, brokerId, force) {
      if (occurrence.source === "avulso") {
        // Avulso vive na escala semanal do plantão (o mesmo caminho da tela de Plantões).
        const form = new FormData();
        form.set("scheduleId", occurrence.scheduleId);
        form.set("brokerId", brokerId);
        form.set("dayOfWeek", String(new Date(`${occurrence.dutyDate}T12:00:00Z`).getUTCDay()));
        form.set("startsAt", occurrence.startsAt.slice(0, 5));
        form.set("endsAt", occurrence.endsAt.slice(0, 5));
        const result = await createRosterAssignmentAction({}, form);
        if (result.error) throw new Error(result.error);
        return;
      }
      try {
        await addBrokerToPublishedOccurrenceAction({ occurrenceId: occurrence.id, brokerId, force: force || undefined });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (occurrence.source !== "draft" || !message.includes(NOT_PUBLISHED)) throw error;
        await updateMonthlyDutyDraftAction({ planId: occurrence.planId, occurrenceId: occurrence.id, brokerId, operation: "add", force: force || undefined });
      }
    },

    async removeSeat(occurrence, brokerId) {
      if (occurrence.source === "avulso") {
        const [row] = await db.select({ id: schema.dutyRosterAssignments.id }).from(schema.dutyRosterAssignments).where(and(
          eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
          eq(schema.dutyRosterAssignments.scheduleId, occurrence.scheduleId),
          eq(schema.dutyRosterAssignments.brokerId, brokerId),
          eq(schema.dutyRosterAssignments.status, "active"),
          isNull(schema.dutyRosterAssignments.dutyDate),
        )).limit(1);
        if (!row) throw new Error("Essa pessoa não está nesse plantão.");
        const form = new FormData();
        form.set("assignmentId", row.id);
        const result = await removeRosterAssignmentAction({}, form);
        if (result.error) throw new Error(result.error);
        return;
      }
      try {
        await removeBrokerFromPublishedOccurrenceAction({ occurrenceId: occurrence.id, brokerId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (occurrence.source !== "draft" || !message.includes(NOT_PUBLISHED)) throw error;
        await updateMonthlyDutyDraftAction({ planId: occurrence.planId, occurrenceId: occurrence.id, brokerId, operation: "remove" });
      }
    },

    async pauseOnDuty(scheduleId, assignmentId, paused) {
      const result = await toggleDutyRosterPauseAction(scheduleId, assignmentId, paused);
      if (!result.success) throw new Error(result.error);
    },

    async markAbsence(scheduleId, assignmentId, absent) {
      const result = await setDutyAbsenceAction(scheduleId, assignmentId, absent);
      if (!result.ok) throw new Error(result.reason);
    },

    async releasePresence(scheduleId, assignmentId, note) {
      return releaseDutyPresenceAction(scheduleId, assignmentId, note);
    },

    async queueOrders() {
      const previews = await getDutyQueueOrderPreviews(context);
      return previews.map((preview) => ({
        scheduleId: preview.scheduleId,
        dutyDate: preview.dutyDate,
        scheduleName: preview.scheduleName,
        order: preview.order.map((item) => ({ id: item.id, name: item.name, position: item.position, isNext: item.isNext })),
        blocked: preview.blocked.map((item) => ({ id: item.id, name: item.name, reason: item.reason })),
        manual: preview.manual,
      }));
    },

    async setQueueOrder(scheduleId, dutyDate, brokerIds) {
      const result = await saveDutyManualQueueAction({ scheduleId, dutyDate, brokerIds });
      if (!result.ok) throw new Error(result.reason);
    },

    async resetQueueOrder(scheduleId, dutyDate) {
      const result = await resetDutyManualQueueAction({ scheduleId, dutyDate });
      if (!result.ok) throw new Error(result.reason);
    },

    async setOnlineMode(scheduleId, assignmentId, online) {
      const result = await setDutyAssignmentAttendanceModeAction({ scheduleId, assignmentId, mode: online ? "online" : null });
      if (!result.ok) throw new Error(result.reason);
    },

    async sendPresenceInvite(scheduleId, assignmentId) {
      const result = await sendDutyPresenceInviteManuallyAction(scheduleId, assignmentId);
      if (!result.ok) throw new Error(result.reason);
      return { delivered: result.delivered };
    },

    async monthPlan(monthKey) {
      const view = await getMonthlyDutyPlanAction(monthKey);
      if (!view) return null;
      const people = new Set(view.occurrences.flatMap((occurrence) => occurrence.brokers.map((broker) => broker.id)));
      return {
        id: view.id,
        monthKey: view.monthKey,
        status: view.status,
        occurrences: view.occurrences.filter((occurrence) => !occurrence.ended).length,
        assigned: view.totalAssigned,
        belowMinimum: typeof view.belowMinimum === "number" ? view.belowMinimum : 0,
        problems: view.problems,
        warnings: view.warnings,
        replacesPublished: view.replacesPublished,
        people: people.size,
      };
    },

    async publishPlan(planId) {
      await publishMonthlyDutyPlanAction(planId);
    },

    async excludeDay(monthKey, dutyDate, restore) {
      const result = await setMonthlyDutyDayExcludedAction({ monthKey, dutyDate, restore: restore || undefined });
      if (!result.ok) throw new Error(result.reason);
      return result.message;
    },

    async setAvailability(brokerIds, target) {
      const form = new FormData();
      form.set("brokerIds", brokerIds.join(","));
      form.set("target", target);
      const result = await setBrokersAvailabilityAction({}, form);
      if (result.error) throw new Error(result.error);
    },

    async record(entry: AgentActionRecord) {
      const id = randomUUID();
      const now = new Date();
      try {
        const [row] = await db.insert(schema.agentActions).values({
          id,
          tenantId: context.tenantId,
          userId: context.userId,
          toolCallId: entry.toolCallId,
          tool: entry.tool,
          requestText: entry.requestText,
          input: entry.input,
          approval: entry.approval,
          status: entry.status,
          message: entry.message.slice(0, 2000),
          undo: entry.undo,
          durationMs: entry.durationMs,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoNothing().returning({ id: schema.agentActions.id });
        return row?.id ?? null;
      } catch (error) {
        console.warn("[agent] trilha não gravada", { tool: entry.tool, message: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
        return null;
      }
    },

    async recentActions(since) {
      try {
        const rows = await db.select({ tool: schema.agentActions.tool, status: schema.agentActions.status, message: schema.agentActions.message, createdAt: schema.agentActions.createdAt, undoneAt: schema.agentActions.undoneAt })
          .from(schema.agentActions)
          .where(and(eq(schema.agentActions.tenantId, context.tenantId), eq(schema.agentActions.userId, context.userId), gt(schema.agentActions.createdAt, since)))
          .orderBy(desc(schema.agentActions.createdAt))
          .limit(50);
        return rows.map((row) => ({ tool: row.tool, status: row.status, message: row.message, createdAt: row.createdAt.toISOString(), undone: Boolean(row.undoneAt) || row.status === "undone" }));
      } catch {
        return [];
      }
    },

    async recorded(toolCallId) {
      try {
        const [row] = await db.select({ id: schema.agentActions.id, message: schema.agentActions.message, status: schema.agentActions.status })
          .from(schema.agentActions)
          .where(and(eq(schema.agentActions.userId, context.userId), eq(schema.agentActions.toolCallId, toolCallId)))
          .limit(1);
        return row ?? null;
      } catch {
        return null;
      }
    },
  };
}
