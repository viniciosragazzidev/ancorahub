import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getDutyRosterSnapshot } from "@/features/lead-distribution/roster-queries";
import { DutyRosterCalendar } from "./_components/duty-roster-calendar";
import { DutyScheduleManager } from "./_components/duty-schedule-manager";

export default async function DutySchedulePage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") redirect("/access-denied");

  const db = getDatabase();
  const branchFilter = context.role === "manager" && context.branchId
    ? and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.id, context.branchId))
    : eq(schema.branches.tenantId, context.tenantId);
  const branches = await db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches).where(branchFilter);
  const branchIds = branches.map((branch) => branch.id);

  // Auto-cria filas padrão para unidades que ainda não possuem filas ativas
  if (branchIds.length > 0) {
    const existingQueues = await db.select({ branchId: schema.leadQueues.branchId })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), inArray(schema.leadQueues.branchId, branchIds), eq(schema.leadQueues.status, "active")));
    const branchesWithQueues = new Set(existingQueues.map((q) => q.branchId));
    for (const branch of branches) {
      if (!branchesWithQueues.has(branch.id)) {
        await db.insert(schema.leadQueues)
          .values({ id: randomUUID(), tenantId: context.tenantId, branchId: branch.id, name: "Fila geral", slug: "geral", isDefault: true, createdAt: new Date(), updatedAt: new Date() })
          .onConflictDoNothing();
      }
    }
  }

  const queues = branchIds.length
    ? await db.select({ id: schema.leadQueues.id, branchId: schema.leadQueues.branchId, name: schema.leadQueues.name })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, context.tenantId), inArray(schema.leadQueues.branchId, branchIds), eq(schema.leadQueues.status, "active")))
    : [];
  const schedules = branchIds.length
    ? await db.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, queueId: schema.unitDutySchedules.queueId, name: schema.unitDutySchedules.name, dayOfWeek: schema.unitDutySchedules.dayOfWeek, startsAt: schema.unitDutySchedules.startsAt, endsAt: schema.unitDutySchedules.endsAt, priority: schema.unitDutySchedules.priority, status: schema.unitDutySchedules.status, webhookCredentialId: schema.unitDutySchedules.webhookCredentialId })
      .from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), inArray(schema.unitDutySchedules.branchId, branchIds)))
      .orderBy(asc(schema.unitDutySchedules.dayOfWeek), asc(schema.unitDutySchedules.startsAt))
    : [];
  const credentials = await db.select({ id: schema.leadWebhookCredentials.id, name: schema.leadWebhookCredentials.name })
    .from(schema.leadWebhookCredentials)
    .where(and(eq(schema.leadWebhookCredentials.tenantId, context.tenantId), eq(schema.leadWebhookCredentials.status, "active")));
  const roster = await getDutyRosterSnapshot(context);

  return (
    <>
      <DashboardHeader breadcrumb="Operação comercial" title="Plantões de distribuição" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section>
          <p className="text-xs font-medium text-primary">REGRAS DE ENTRADA</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Plantões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize a escala visual sem alterar as regras de fila, disponibilidade ou distribuição automática.
          </p>
        </section>
        <DutyRosterCalendar branches={roster.branches} brokers={roster.brokers} schedules={roster.schedules} initialAssignments={roster.assignments} />
        <DutyScheduleManager branches={branches} queues={queues} schedules={schedules} credentials={credentials} />
      </main>
    </>
  );
}
