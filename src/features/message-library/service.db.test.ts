/**
 * Message library on the real schema, inside ONE transaction that is ROLLED
 * BACK (nothing is committed, nothing is sent). Also renders every team notice
 * for the test broker "Vinicios Ragazzi A." so the wording can be checked.
 * Opt-in only:
 *   RUN_LIBRARY_DB_E2E=1 npx vitest run src/features/message-library/service.db.test.ts
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { and, eq, ilike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as realSchema from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";

vi.mock("server-only", () => ({}));
const state: { tx: unknown; context: TenantContext | null } = { tx: null, context: null };
vi.mock("@/shared/db", () => ({ schema: realSchema, getDatabase: () => state.tx }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));

const enabled = process.env.RUN_LIBRARY_DB_E2E === "1";
function readLocalEnv(name: string) {
  if (!existsSync(".env.local")) return "";
  const line = readFileSync(".env.local", "utf8").split(String.fromCharCode(10)).map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "") : "";
}
const url = enabled ? (readLocalEnv("SUPABASE_DB_URL") || readLocalEnv("DATABASE_URL")) : "";
const client = enabled ? postgres(url, { prepare: false, max: 1 }) : null;
const db = client ? drizzle(client, { schema: realSchema }) : null;
afterAll(async () => { await client?.end({ timeout: 5 }); });
class Rollback extends Error {}

describe.skipIf(!enabled)("message library (real schema, rolled back)", () => {
  it("shows where a message is used, refuses to remove it while used, and renders team notices for Vinicios Ragazzi A.", async () => {
    await db!.transaction(async (tx) => {
      state.tx = tx;
      const s = realSchema;
      // Vinicios Ragazzi A.: the test broker (active membership), and a director of the same tenant.
      const [vinicios] = await tx.select({ userId: s.user.id, name: s.user.name, tenantId: s.tenantMemberships.tenantId })
        .from(s.user).innerJoin(s.tenantMemberships, eq(s.tenantMemberships.userId, s.user.id))
        .where(and(ilike(s.user.name, "Vinicios Ragazzi A%"), eq(s.tenantMemberships.status, "active"), eq(s.tenantMemberships.role, "broker"))).limit(1);
      expect(vinicios, "Vinicios Ragazzi A. must exist as an active broker").toBeTruthy();
      const [director] = await tx.select({ userId: s.tenantMemberships.userId }).from(s.tenantMemberships)
        .where(and(eq(s.tenantMemberships.tenantId, vinicios.tenantId), eq(s.tenantMemberships.role, "director"), eq(s.tenantMemberships.status, "active"))).limit(1);
      state.context = { userId: director.userId, tenantId: vinicios.tenantId, role: "director", jobTitle: "director", branchId: null };

      const library = await import("./service");
      const actions = await import("@/features/ai-qualification/actions");

      // A free message used by a team notice.
      const messageId = randomUUID();
      await tx.insert(s.messageTemplates).values({ id: messageId, tenantId: vinicios.tenantId, name: "Teste biblioteca", category: "operational", content: "Olá {{nome}}, teste da biblioteca.", variables: [], active: true, createdBy: director.userId });
      await tx.insert(s.teamNoticeSettings).values({ tenantId: vinicios.tenantId, noticeKey: "TASK_REMINDER", enabled: true, channel: "company_number", freeMessageId: messageId })
        .onConflictDoUpdate({ target: [s.teamNoticeSettings.tenantId, s.teamNoticeSettings.noticeKey], set: { enabled: true, channel: "company_number", freeMessageId: messageId } });

      const rows = await library.getMessageLibrary(vinicios.tenantId);
      const row = rows.find((item) => item.id === messageId)!;
      expect(row).toMatchObject({ kind: "free_message", kindLabel: "Mensagem livre", variables: ["nome"] });
      expect(row.usages.map((usage) => usage.label)).toEqual(["Aviso da equipe: Lembrete de tarefa"]);
      expect(row.validity.map((item) => item.valid)).toEqual(["window", "always"]);
      expect(rows.some((item) => item.kind === "meta_template")).toBe(true);

      // Refused while used; allowed once nothing uses it.
      const refused = await actions.deleteFreeMessageTemplateAction(messageId);
      expect(refused).toEqual({ success: false, error: expect.stringContaining("Aviso da equipe: Lembrete de tarefa") });
      const [still] = await tx.select({ active: s.messageTemplates.active }).from(s.messageTemplates).where(eq(s.messageTemplates.id, messageId));
      expect(still.active).toBe(true);
      await tx.update(s.teamNoticeSettings).set({ freeMessageId: null }).where(and(eq(s.teamNoticeSettings.tenantId, vinicios.tenantId), eq(s.teamNoticeSettings.noticeKey, "TASK_REMINDER")));
      expect(await actions.deleteFreeMessageTemplateAction(messageId)).toEqual({ success: true });

      // Every team notice as Vinicios Ragazzi A. would read it through the company number.
      const { TEAM_NOTICES } = await import("@/features/team-notices/catalog");
      const { renderTeamNoticeText } = await import("@/features/team-notices/service");
      const { resolveTemplateTextBody } = await import("@/features/communication-channels/outbound-service");
      const leadId = randomUUID();
      const variablesFor: Record<string, string[]> = {
        newLeadAssignment: ["Corretor(a)", vinicios.name, "Lead de teste", "Plano de saúde", leadId],
        brokerLeadNotification: ["Corretor(a)", vinicios.name, "Lead de teste", "Plano de saúde", leadId],
        leadAssignmentConfirmed: [vinicios.name, "Lead de teste", "(21) 90000-0000", "Plano de saúde", "Individual", "0", "Niterói", leadId],
        leadAssignmentUnavailable: [vinicios.name, "Lead de teste"],
        leadAssignmentExpired: [vinicios.name, "Lead de teste"],
        leadFeedbackReminder: [vinicios.name, "Lead de teste"],
        taskReminder: [vinicios.name, "Ligar para o lead de teste", "30/09 14:00"],
        brokerAccountActivated: [vinicios.name, "Âncora", "https://crm.ancorasaude.cloud/login"],
        dutyPresenceConfirmation: [vinicios.name, "09:00", randomUUID()],
      };
      const rendered: Record<string, string> = {};
      for (const notice of TEAM_NOTICES) {
        if (notice.metaOnly) continue;
        const variables = variablesFor[notice.purpose] ?? [vinicios.name];
        rendered[notice.label] = await renderTeamNoticeText({ tenantId: vinicios.tenantId, notice, setting: { enabled: true, channel: "company_number", freeMessageId: null }, variables, builtIn: resolveTemplateTextBody(notice.purpose, variables) });
        expect(rendered[notice.label], notice.label).toContain(vinicios.name);
      }
      expect(rendered["Novo lead disponível"]).toContain(`/leads/${leadId}`);
      expect(rendered["Confirmação de presença no plantão"]).toContain("/confirm_presence?id=");
      if (process.env.LIBRARY_REPORT_FILE) writeFileSync(process.env.LIBRARY_REPORT_FILE, JSON.stringify(rendered, null, 2));

      throw new Rollback();
    }).catch((error) => { if (!(error instanceof Rollback)) throw error; });
  }, 120_000);
});
