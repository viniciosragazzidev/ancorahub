"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/arc/badge/badge";
import { PeopleEmpty, PeoplePage, PeopleSection, PeopleStats } from "@/components/light/people-list/people-list";
import { Button } from "@/components/ui/button";

import type { SupervisorControlData, SupervisorControlGroup } from "./control-queries";
import type { SupervisorPendingReason } from "./control-core";

const REASON_LABEL: Record<SupervisorPendingReason, string> = {
  offer_waiting: "Oferta sem aceite",
  first_contact_overdue: "Primeiro contato atrasado",
  return_overdue: "Retorno vencido",
};

const AVAILABILITY_LABEL: Record<string, string> = { available: "Disponível", paused: "Pausado", offline: "Offline" };
const AVAILABILITY_TONE: Record<string, "success" | "warning" | "neutral"> = { available: "success", paused: "warning", offline: "neutral" };

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function Group({ group }: { group: SupervisorControlGroup }) {
  return (
    <PeopleSection title={REASON_LABEL[group.reason]} count={group.count} label={`${REASON_LABEL[group.reason]} por lead`}>
      {group.items.map((item) => (
        <li key={item.id} className="grid min-w-0 gap-2 border-b border-(--border) px-3 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <Link href={`/leads/${encodeURIComponent(item.leadId)}`} className="font-medium text-(--foreground) underline-offset-4 hover:underline">{item.leadName}</Link>
            <p className="mt-1 break-words text-sm text-(--text-secondary)">{item.detail}</p>
            <Link href={`/equipe/${encodeURIComponent(item.brokerId)}`} className="mt-1 inline-block text-xs text-(--text-muted) underline-offset-4 hover:underline">Com {item.brokerName}</Link>
          </div>
          <time className="text-xs text-(--text-muted) sm:text-right" dateTime={item.dueAt ?? undefined}>{item.dueAt ? formatTime(item.dueAt) : "Agora"}</time>
        </li>
      ))}
      {group.remaining > 0 ? <li className="px-3 py-3 text-sm text-(--text-muted)">E mais {group.remaining} {group.remaining === 1 ? "pendência" : "pendências"} neste grupo.</li> : null}
    </PeopleSection>
  );
}

export function SupervisorControlPanel({ initialData }: { initialData: SupervisorControlData }) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || inFlight) return;
      inFlight = true;
      setRefreshing(true);
      try {
        const response = await fetch("/api/supervisor/control", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) throw new Error("snapshot_unavailable");
        const next = await response.json() as SupervisorControlData;
        if (!disposed) {
          setData(next);
          setFailed(false);
        }
      } catch {
        if (!disposed) setFailed(true);
      } finally {
        inFlight = false;
        if (!disposed) setRefreshing(false);
      }
    };
    const timer = window.setInterval(() => void refresh(), 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const totalPendencies = data.pendencies.reduce((sum, group) => sum + group.count, 0);
  const onDuty = data.brokers.filter((broker) => broker.onDuty).length;
  const inService = data.brokers.reduce((sum, broker) => sum + broker.inService, 0);

  return (
    <PeoplePage
      title="Controle da equipe"
      subtitle="Acompanhe os corretores da sua equipe e veja o que precisa de atenção agora."
      action={<div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" render={<Link href="/equipe/observacoes" />}>Observações da equipe</Button><span className="text-xs text-(--text-muted)" role="status" aria-live="polite">{failed ? "Atualização indisponível" : refreshing ? "Atualizando…" : `Atualizado ${formatTime(data.updatedAt)}`}</span></div>}
    >
      <PeopleStats label="Resumo atual da equipe" items={[
        { value: data.brokers.length, label: "corretores ativos" },
        { value: onDuty, label: "em plantão" },
        { value: inService, label: "leads em atendimento" },
        { value: totalPendencies, label: "pendências acionáveis", alert: totalPendencies > 0 },
      ]} />

      <PeopleSection title="Agora por corretor" count={data.brokers.length} label="Situação e indicadores da equipe">
        {data.brokers.map((broker) => (
          <li key={broker.id} className="grid min-w-0 gap-3 border-b border-(--border) px-3 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(90px,1fr))] md:items-center">
            <div className="min-w-0">
              <Link href={`/equipe/${encodeURIComponent(broker.id)}`} className="font-medium text-(--foreground) underline-offset-4 hover:underline">{broker.name}</Link>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge size="sm" tone={AVAILABILITY_TONE[broker.availability] ?? "neutral"}>{AVAILABILITY_LABEL[broker.availability] ?? "Sem status"}</Badge>
                <Badge size="sm" tone={broker.onDuty ? "success" : "neutral"}>{broker.onDuty ? `Plantão · ${broker.dutyName ?? "ativo"}` : "Fora do plantão"}</Badge>
                {broker.onDuty && broker.presence ? <Badge size="sm" tone={broker.presence === "confirmed" ? "success" : "warning"}>{broker.presence === "confirmed" ? "Presença confirmada" : "Presença pendente"}</Badge> : null}
              </div>
            </div>
            <Metric label="Em atendimento" value={broker.inService} />
            <Metric label="Aceites hoje" value={broker.acceptsToday} />
            <Metric label="Primeiros contatos hoje" value={broker.firstContactsToday} />
            <Metric label="Disponibilidade" value={AVAILABILITY_LABEL[broker.availability] ?? "Sem status"} />
          </li>
        ))}
      </PeopleSection>
      {!data.brokers.length ? <PeopleEmpty title="Sua equipe está sem corretores ativos" description="Quando os corretores estiverem vinculados à sua supervisão, os indicadores aparecerão aqui." /> : null}

      <div className="space-y-4" aria-label="Pendências que precisam de ação">
        <h2 className="text-base font-semibold text-(--foreground)">Pendências acionáveis</h2>
        {data.pendencies.length ? data.pendencies.map((group) => <Group key={group.reason} group={group} />) : <PeopleEmpty title="Nenhuma pendência acionável" description="Ofertas, primeiros contatos e retornos dentro do prazo não aparecem como atraso." />}
      </div>
    </PeoplePage>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="flex items-baseline justify-between gap-2 text-sm md:block"><span className="text-(--text-muted)">{label}</span><strong className="font-semibold tabular-nums text-(--foreground)">{value}</strong></div>;
}
