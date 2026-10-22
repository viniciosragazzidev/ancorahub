import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { effectiveAttendanceMode, getSelfDutyConfirmationWindowState, SELF_CONFIRM_LATE_MESSAGE, SELF_CONFIRM_OPENS_MINUTES } from "@/features/lead-distribution/duty-presence-domain";
import { getDatabase, schema } from "@/shared/db";
import { ConfirmDutyPresenceButton } from "./confirm-duty-presence-button";

export const dynamic = "force-dynamic";

export default async function ConfirmPresencePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const confirmationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? "") ? id! : null;
  const [record] = confirmationId ? await getDatabase().select({
    id: schema.dutyPresenceConfirmations.id,
    assignmentId: schema.dutyPresenceConfirmations.assignmentId,
    status: schema.dutyPresenceConfirmations.status,
    brokerName: schema.user.name,
    scheduleName: schema.unitDutySchedules.name,
    branchName: schema.branches.name,
    timezone: schema.unitDutySchedules.timezone,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
    assignmentAttendanceMode: schema.dutyRosterAssignments.attendanceMode,
    shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt,
    shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt,
    joinedAt: schema.dutyRosterAssignments.createdAt,
  }).from(schema.dutyPresenceConfirmations)
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyPresenceConfirmations.brokerId))
    .innerJoin(schema.unitDutySchedules, and(
      eq(schema.unitDutySchedules.id, schema.dutyPresenceConfirmations.scheduleId),
      eq(schema.unitDutySchedules.tenantId, schema.dutyPresenceConfirmations.tenantId),
    ))
    .leftJoin(schema.branches, and(
      eq(schema.branches.id, schema.unitDutySchedules.branchId),
      eq(schema.branches.tenantId, schema.dutyPresenceConfirmations.tenantId),
    ))
    .leftJoin(schema.dutyRosterAssignments, and(
      eq(schema.dutyRosterAssignments.id, schema.dutyPresenceConfirmations.assignmentId),
      eq(schema.dutyRosterAssignments.tenantId, schema.dutyPresenceConfirmations.tenantId),
    ))
    .where(eq(schema.dutyPresenceConfirmations.id, confirmationId)).limit(1) : [];

  const now = new Date();
  const windowState = record?.status === "pending" ? getSelfDutyConfirmationWindowState({ startsAt: record.shiftStartsAt, endsAt: record.shiftEndsAt, now, joinedAt: record.joinedAt }) : null;
  const active = windowState === "available";
  const late = windowState === "late";
  const confirmed = record?.status === "confirmed";
  const presencial = record ? effectiveAttendanceMode(record.assignmentAttendanceMode, record.attendanceMode) === "presencial" : false;
  return <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <div className="mb-2 grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><Clock3 className="size-7" aria-hidden="true" /></div>
        <CardTitle>{record ? `Plantão ${record.scheduleName}` : "Confirmação de plantão"}</CardTitle>
        <CardDescription>{record ? `${record.branchName ? `${record.branchName} · ` : ""}${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: record.timezone }).format(record.shiftStartsAt)}` : "Confirme sua presença na escala informada pela equipe."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {!confirmationId || !record ? <p role="alert" className="text-sm text-muted-foreground">Este link não é válido ou não está mais disponível. Peça um novo lembrete à gestão.</p> : confirmed ? <div className="space-y-2 text-sm"><CheckCircle2 className="mx-auto size-8 text-success" aria-hidden="true" /><p className="font-medium">Presença confirmada</p><p className="text-muted-foreground">Obrigado, {record.brokerName}. Você está elegível para receber leads deste plantão enquanto ele estiver ativo.</p></div> : late ? <p role="alert" className="text-sm text-muted-foreground">{SELF_CONFIRM_LATE_MESSAGE}</p> : active && presencial ? <><p className="text-sm text-muted-foreground">Olá, <span className="font-medium text-foreground">{record.brokerName}</span>. Este plantão é <span className="font-medium text-foreground">presencial</span>: você precisa estar na unidade durante todo o plantão. Já na unidade, abra o app e tire uma foto do local; o diretor valida a foto e libera você.</p><Link href={`/plantoes/agora?assignment=${encodeURIComponent(record.assignmentId)}`} className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">Abrir o app e tirar a foto</Link></> : active ? <><p className="text-sm text-muted-foreground">Olá, <span className="font-medium text-foreground">{record.brokerName}</span>. Toque abaixo para confirmar que está disponível para este plantão.</p><ConfirmDutyPresenceButton confirmationId={record.id} /></> : windowState === "not_open" ? <p role="status" className="text-sm text-muted-foreground">A confirmação abre {SELF_CONFIRM_OPENS_MINUTES} minutos antes do início do plantão. Volte então para confirmar.</p> : <p role="alert" className="text-sm text-muted-foreground">O prazo deste plantão terminou. Entre em contato com a gestão se precisar de ajuda.</p>}
      </CardContent>
    </Card>
  </main>;
}
