"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sendPlantaoReportNowAction, setPlantaoReportEnabledAction } from "@/features/reports/plantao-report-actions";
import type { loadPlantaoReportPageData } from "@/features/reports/plantao-report";

type PageData = Awaited<ReturnType<typeof loadPlantaoReportPageData>>;

function statusLabel(state: NonNullable<PageData["status"]>["state"]) {
  if (state === "sent") return "Enviado";
  if (state === "sending") return "Envio em andamento";
  if (state === "failed") return "Falha no envio";
  if (state === "before_schedule") return "Aguardando o horário";
  return "Desativado";
}

export function PlantaoReportSettings({ data }: { data: PageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const status = data.status?.day === data.day ? data.status : null;
  const sentToday = status?.state === "sent" || data.lockedForToday && data.reservationState === "sent";
  const visibleStatus = sentToday ? "sent" : status?.state ?? null;
  const canSend = data.globallyEnabled && data.config.enabled && Boolean(data.preview) && !data.lockedForToday && !isPending;

  function toggleEnabled() {
    startTransition(async () => {
      const result = await setPlantaoReportEnabledAction(!data.config.enabled);
      setFeedback(result.ok
        ? { tone: "success", message: result.enabled ? "Envio automático ativado." : "Envio automático desativado." }
        : { tone: "error", message: result.error });
      router.refresh();
    });
  }

  function sendNow() {
    startTransition(async () => {
      setFeedback(null);
      const result = await sendPlantaoReportNowAction();
      setFeedback(result.ok ? { tone: "success", message: result.message } : { tone: "error", message: result.error });
      router.refresh();
    });
  }

  return <div className="grid w-full gap-4 lg:max-w-4xl">
    <Card>
      <CardHeader>
        <CardTitle>Envio diário pelo WhatsApp</CardTitle>
        <CardDescription>Prévia do resultado do plantão de hoje. O envio automático está programado para as {String(data.config.hour).padStart(2, "0")}h, no horário de São Paulo, para o grupo {data.config.groupName}.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!data.globallyEnabled ? <p role="status" className="text-sm text-muted-foreground">Este recurso está desativado pelo Super-admin.</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={isPending || !data.globallyEnabled} onClick={toggleEnabled}>
            {isPending ? "Salvando..." : data.config.enabled ? "Desativar envio automático" : "Ativar envio automático"}
          </Button>
          <Button type="button" disabled={!canSend} onClick={sendNow}>
            {isPending ? "Enviando..." : sentToday ? "Enviado hoje" : data.lockedForToday ? "Tentativa registrada hoje" : "Enviar agora"}
          </Button>
          <span className="text-sm text-muted-foreground">{data.config.enabled ? "Agendamento ativo" : "Agendamento desligado"}</span>
        </div>
        {visibleStatus ? <p className="text-sm text-muted-foreground" role="status">
          Hoje: {statusLabel(visibleStatus)}{status?.sentAt ? ` às ${new Date(status.sentAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` : ""}{status?.error ? `. ${status.error}` : ""}
        </p> : null}
        {data.previewError ? <p role="alert" className="text-sm text-destructive">{data.previewError}</p> : null}
        {feedback ? <p role="status" aria-live="polite" className={`text-sm ${feedback.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>{feedback.message}</p> : null}
        {data.preview ? <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-sans text-sm leading-6">{data.preview.text}</pre> : null}
        <p className="text-xs text-muted-foreground">O envio manual usa uma chave própria e não bloqueia o envio automático do dia. O cron mantém um envio por dia. A prévia usa as filas originais dos leads e as ofertas aceitas até agora.</p>
      </CardContent>
    </Card>
  </div>;
}
