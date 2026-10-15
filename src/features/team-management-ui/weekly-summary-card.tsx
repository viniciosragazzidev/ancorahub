"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/arc/badge/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecognizeSheet } from "@/features/journey/components/recognize-sheet";
import { recognizeBrokerAction } from "@/features/journey/recognition-actions";
import type { WeeklySummaryValues } from "@/features/team-management/g6-pure";
import type { WeeklyHighlightBrokerOption } from "@/features/team-management/weekly-highlights-data";

const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export function WeeklySummaryCard({
  summary,
  manualRecognitionBrokers = [],
  canRecognize = false,
}: {
  summary: WeeklySummaryValues;
  manualRecognitionBrokers?: WeeklyHighlightBrokerOption[];
  canRecognize?: boolean;
}) {
  const [selectedBrokerId, setSelectedBrokerId] = useState(manualRecognitionBrokers[0]?.id ?? "");
  const [recognizeOpen, setRecognizeOpen] = useState(false);
  const selectedBroker = manualRecognitionBrokers.find((broker) => broker.id === selectedBrokerId) ?? manualRecognitionBrokers[0] ?? null;

  return (
    <Card className="border-border bg-card shadow-none" aria-labelledby="weekly-summary-title">
      <CardHeader className="gap-1">
        <CardTitle id="weekly-summary-title" role="heading" aria-level={2} className="text-base">Esta semana</CardTitle>
        <CardDescription>Resumo dos últimos sete dias. Os destaques respeitam o opt-out de ranking.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-muted/45 p-3"><dt className="text-xs text-muted-foreground">Leads recebidos</dt><dd className="mt-1 font-mono text-lg font-semibold">{summary.leadsReceived}</dd></div>
          <div className="rounded-lg bg-muted/45 p-3"><dt className="text-xs text-muted-foreground">Aceites</dt><dd className="mt-1 font-mono text-lg font-semibold">{summary.accepted}<span className="text-sm font-normal text-muted-foreground"> / {summary.received}</span></dd></div>
          <div className="rounded-lg bg-muted/45 p-3"><dt className="text-xs text-muted-foreground">SLA no prazo</dt><dd className="mt-1 font-mono text-lg font-semibold">{percent.format(summary.slaRate)}%</dd></div>
          <div className="rounded-lg bg-muted/45 p-3"><dt className="text-xs text-muted-foreground">Conversão</dt><dd className="mt-1 font-mono text-lg font-semibold">{percent.format(summary.conversionRate)}%</dd></div>
        </dl>

        <section aria-labelledby="weekly-highlights-title" className="grid gap-3">
          <h3 id="weekly-highlights-title" className="text-sm font-semibold">Destaques da semana</h3>
          {summary.highlights.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {summary.highlights.map((item) => (
                <li key={item.category} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <Link className="block truncate text-sm font-medium underline-offset-4 hover:underline" href={`/equipe/${encodeURIComponent(item.brokerId)}`}>{item.brokerName}</Link>
                  </div>
                  <Badge tone="neutral" size="sm" className="shrink-0">{item.value}</Badge>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">Ainda nao ha dados suficientes para formar destaques.</p>}
        </section>

        {canRecognize && manualRecognitionBrokers.length ? (
          <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5">
              <label htmlFor="manual-highlight-broker" className="text-sm font-medium">Destaque manual</label>
              <Select value={selectedBroker?.id ?? ""} onValueChange={(value) => value && setSelectedBrokerId(value)}>
                <SelectTrigger id="manual-highlight-broker" aria-label="Corretor para reconhecimento">
                  <SelectValue placeholder="Escolha um corretor" />
                </SelectTrigger>
                <SelectContent>
                  {manualRecognitionBrokers.map((broker) => <SelectItem key={broker.id} value={broker.id}>{broker.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" disabled={!selectedBroker} onClick={() => setRecognizeOpen(true)}>Reconhecer corretor</Button>
            {selectedBroker ? <RecognizeSheet brokerId={selectedBroker.id} brokerName={selectedBroker.name} open={recognizeOpen} onOpenChange={setRecognizeOpen} onRecognize={recognizeBrokerAction} /> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
