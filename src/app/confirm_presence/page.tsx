import { and, eq } from "drizzle-orm";
import { CheckCircle2, Clock3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDatabase, schema } from "@/shared/db";
import { ConfirmDutyPresenceButton } from "./confirm-duty-presence-button";

export const dynamic = "force-dynamic";

export default async function ConfirmPresencePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const confirmationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id ?? "") ? id! : null;
  const [record] = confirmationId ? await getDatabase().select({
    id: schema.dutyPresenceConfirmations.id,
    status: schema.dutyPresenceConfirmations.status,
    brokerName: schema.user.name,
    scheduleName: schema.unitDutySchedules.name,
    timezone: schema.unitDutySchedules.timezone,
    shiftStartsAt: schema.dutyPresenceConfirmations.shiftStartsAt,
    shiftEndsAt: schema.dutyPresenceConfirmations.shiftEndsAt,
  }).from(schema.dutyPresenceConfirmations)
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyPresenceConfirmations.brokerId))
    .innerJoin(schema.unitDutySchedules, and(
      eq(schema.unitDutySchedules.id, schema.dutyPresenceConfirmations.scheduleId),
      eq(schema.unitDutySchedules.tenantId, schema.dutyPresenceConfirmations.tenantId),
    ))
    .where(eq(schema.dutyPresenceConfirmations.id, confirmationId)).limit(1) : [];

  const active = Boolean(record && record.status === "pending" && record.shiftEndsAt > new Date());
  const confirmed = record?.status === "confirmed";
  return <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <div className="mb-2 grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><Clock3 className="size-7" aria-hidden="true" /></div>
        <CardTitle>Confirmação de plantão</CardTitle>
        <CardDescription>{record ? `${record.scheduleName} · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: record.timezone }).format(record.shiftStartsAt)}` : "Confirme sua presença na escala informada pela equipe."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {!confirmationId || !record ? <p role="alert" className="text-sm text-muted-foreground">Este link não é válido ou não está mais disponível. Peça um novo lembrete à gestão.</p> : confirmed ? <div className="space-y-2 text-sm"><CheckCircle2 className="mx-auto size-8 text-success" aria-hidden="true" /><p className="font-medium">Presença confirmada</p><p className="text-muted-foreground">Obrigado, {record.brokerName}. Você está elegível para receber leads deste plantão enquanto ele estiver ativo.</p></div> : active ? <><p className="text-sm text-muted-foreground">Olá, <span className="font-medium text-foreground">{record.brokerName}</span>. Toque abaixo para confirmar que está disponível para este plantão.</p><ConfirmDutyPresenceButton confirmationId={record.id} /></> : <p role="alert" className="text-sm text-muted-foreground">O prazo deste plantão terminou. Entre em contato com a gestão se precisar de ajuda.</p>}
      </CardContent>
    </Card>
  </main>;
}
