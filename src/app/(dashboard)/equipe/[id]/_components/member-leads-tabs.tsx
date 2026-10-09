"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { LeadStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { getTeamMemberProfile } from "@/features/team/member-profile";
import { cn } from "@/lib/utils";
import { TEMPERATURE_UI, type Temperature } from "./member-temperature";

type Lead = NonNullable<Awaited<ReturnType<typeof getTeamMemberProfile>>>["recentLeads"][number];
type Period = "today" | "7d" | "30d" | "month" | "all";

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "all", label: "Todos" },
];

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });

const asTemperature = (value: string | null | undefined): Temperature | null => (value === "hot" || value === "warm" || value === "cold" ? value : null);

/** When the lead reached this broker (assignment, or creation for old rows). */
const receivedAt = (lead: Lead) => new Date(lead.assignedAt ?? lead.createdAt);

function inPeriod(lead: Lead, period: Period, now: Date) {
  if (period === "all") return true;
  const at = receivedAt(lead);
  const today = dayKey.format(now);
  if (period === "today") return dayKey.format(at) === today;
  if (period === "month") return dayKey.format(at).slice(0, 7) === today.slice(0, 7);
  const days = period === "7d" ? 7 : 30;
  return now.getTime() - at.getTime() <= days * 86_400_000;
}

/** The broker's portfolio by period, with the temperature of each lead. */
export function MemberLeadsTabs({ leads, limit }: { leads: Lead[]; limit: number }) {
  const [period, setPeriod] = useState<Period>("7d");
  const [temperature, setTemperature] = useState<Temperature | null>(null);
  const now = useMemo(() => new Date(), []);
  const counts = useMemo(() => Object.fromEntries(PERIODS.map((item) => [item.id, leads.filter((lead) => inPeriod(lead, item.id, now)).length])) as Record<Period, number>, [leads, now]);
  const inThisPeriod = useMemo(() => leads.filter((lead) => inPeriod(lead, period, now)), [leads, now, period]);
  const byTemperature = useMemo(() => {
    const result: Record<Temperature, number> = { hot: 0, warm: 0, cold: 0 };
    for (const lead of inThisPeriod) {
      const key = asTemperature(lead.temperature);
      if (key) result[key] += 1;
    }
    return result;
  }, [inThisPeriod]);
  const shown = temperature ? inThisPeriod.filter((lead) => asTemperature(lead.temperature) === temperature) : inThisPeriod;

  return (
    <section aria-label="Carteira por período" className="overflow-hidden rounded-[var(--radius-card-lg,16px)] border border-border bg-card">
      <header className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Leads recebidos</h2>
          <p className="text-xs text-muted-foreground">
            Pela data em que chegaram ao corretor.{leads.length >= limit ? ` Considera os ${limit} mais recentes.` : ""}
          </p>
        </div>
        <div role="tablist" aria-label="Período" className="flex flex-wrap gap-1 rounded-[var(--radius-card)] border border-border bg-muted/40 p-0.5">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={period === item.id}
              onClick={() => setPeriod(item.id)}
              className={cn("rounded-full px-3 py-1 text-xs font-medium tabular-nums transition-colors", period === item.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {item.label} <span className="text-muted-foreground">{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </header>
      <div role="group" aria-label="Filtrar por temperatura" className="flex flex-wrap items-center gap-1.5 border-b border-border/70 px-4 py-2.5">
        <span className="mr-1 text-xs text-muted-foreground">Temperatura</span>
        {(Object.keys(TEMPERATURE_UI) as Temperature[]).map((key) => {
          const active = temperature === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setTemperature(active ? null : key)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs tabular-nums", active ? "border-foreground/40 bg-muted" : "border-border bg-card hover:border-foreground/30")}
            >
              <span aria-hidden="true" className={cn("size-2 rounded-full", TEMPERATURE_UI[key].dot)} />
              {TEMPERATURE_UI[key].label} · {byTemperature[key]}
            </button>
          );
        })}
        {temperature ? <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setTemperature(null)}>Limpar</button> : null}
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {shown.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Temperatura</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>1º contato</TableHead>
                <TableHead>Recebido em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((lead) => {
                const leadTemperature = asTemperature(lead.temperature);
                return (
                <TableRow key={lead.id}>
                  <TableCell className="max-w-[16rem]">
                    <Link href={`/leads/${lead.id}`} className="block truncate font-medium underline-offset-4 hover:underline">{lead.name}</Link>
                    {lead.queueName ? <span className="block truncate text-xs text-muted-foreground">{lead.queueName}</span> : null}
                  </TableCell>
                  <TableCell>
                    {leadTemperature ? (
                      <span className="inline-flex items-center gap-1.5 text-xs"><span aria-hidden="true" className={cn("size-2 rounded-full", TEMPERATURE_UI[leadTemperature].dot)} />{TEMPERATURE_UI[leadTemperature].label}</span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell><LeadStatusBadge status={lead.status} /></TableCell>
                  <TableCell>{lead.firstContactAt ? <span className="text-xs">{dateTime.format(new Date(lead.firstContactAt))}</span> : <Badge variant="warning">Pendente</Badge>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{dateTime.format(receivedAt(lead))}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum lead {temperature ? `${TEMPERATURE_UI[temperature].label.toLocaleLowerCase("pt-BR")} ` : ""}neste período.</p>
        )}
      </div>
    </section>
  );
}
