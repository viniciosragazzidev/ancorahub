"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import { DsDialog, DsDialogDescription, DsDialogFooter, DsDialogHeader, DsDialogPopup, DsDialogTitle } from "@/components/ui/ds-dialog";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsFilledDarkCta } from "@/components/ui/ds-filled-dark-cta";
import { DsInputField } from "@/components/ui/ds-input-field";
import { DsOutlinedActionButton } from "@/components/ui/ds-outlined-action-button";
import { DsSectionHeader } from "@/components/ui/ds-section-header";
import { DsStatusBadge } from "@/components/ui/ds-status-badge";
import type { JourneyActionResponse, JourneyRiskEvent, JourneyRiskReport, ReverseJourneyEventInput } from "@/features/journey/director-types";

const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Audit of points (director): brokers whose points by rule are far from the
 * rest (z-score), repeated notes and unusual contacts, and the recent events
 * with "Estornar" (reason required, audited).
 */
export function AuditTab({ report, onReverse }: { report: JourneyRiskReport | null; onReverse?: (input: ReverseJourneyEventInput) => Promise<JourneyActionResponse> }) {
  const [events, setEvents] = useState(report?.events ?? []);
  const [target, setTarget] = useState<JourneyRiskEvent | null>(null);
  if (!report?.available) return <DsEmptyState className="mt-ds-24" bordered title="Auditoria indisponível" description="Ela aparece quando a jornada estiver ligada." />;
  const flagged = report.brokers.filter((broker) => broker.rules.some((rule) => rule.outlier) || broker.repeatedNotes > 0 || broker.unusualContacts > 0);

  return (
    <div className="mt-ds-24 space-y-ds-24 ds-fade">
      <div className="space-y-ds-12">
        <DsSectionHeader title="Pontos fora do padrão" description="Quem pontuou muito acima da equipe numa regra, notas repetidas ou contatos estranhos. Não é acusação: é onde olhar primeiro." />
        {flagged.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {flagged.map((broker) => (
              <li key={broker.brokerId} className="space-y-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">{broker.name}</p>
                  <span className="shrink-0 tabular-nums text-sm text-muted-foreground">{broker.points.toLocaleString("pt-BR")} pts</span>
                </div>
                <ul className="flex flex-wrap gap-1.5">
                  {broker.rules.filter((rule) => rule.outlier).map((rule) => <li key={rule.ruleKey}><DsStatusBadge status="warning" label={`${rule.label}: bem acima da média`} title={`${rule.zScore.toFixed(1)} desvios acima da média da equipe`} /></li>)}
                  {broker.repeatedNotes ? <li><DsStatusBadge status="warning" label={`${broker.repeatedNotes} notas repetidas`} /></li> : null}
                  {broker.unusualContacts ? <li><DsStatusBadge status="warning" label={`${broker.unusualContacts} contatos estranhos`} /></li> : null}
                </ul>
              </li>
            ))}
          </ul>
        ) : <DsEmptyState bordered icon={<ShieldCheck size={18} />} title="Nada fora do padrão nesta semana" description="Os pontos estão parecidos entre os corretores." />}
      </div>

      <div className="space-y-ds-12">
        <DsSectionHeader title="Últimos pontos" description="Estornar tira o ponto do placar e do nível. Fica registrado quem estornou e por quê." />
        {events.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate"><span className="font-medium">{event.brokerName}</span> · {event.detail ?? event.ruleKey}</p>
                  <p className="text-xs text-muted-foreground">{dateTime.format(new Date(event.occurredAt))}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`tabular-nums ${event.reversedAt ? "text-muted-foreground line-through" : "font-medium"}`}>+{event.points}</span>
                  {event.reversedAt ? <DsStatusBadge status="secondary" label="Estornado" /> : onReverse ? <DsOutlinedActionButton onClick={() => setTarget(event)}>Estornar</DsOutlinedActionButton> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <DsEmptyState bordered icon={<ShieldAlert size={18} />} title="Nenhum ponto ainda" description="Os eventos aparecem aqui conforme a equipe pontua." />}
      </div>

      {onReverse ? (
        <ReverseDialog
          event={target}
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            if (!target) return { ok: false, message: "Escolha um ponto." } as const;
            const result = await onReverse({ eventId: target.id, reason });
            if (result.ok) setEvents((current) => current.map((item) => (item.id === target.id ? { ...item, reversedAt: new Date().toISOString() } : item)));
            return result;
          }}
        />
      ) : null}
    </div>
  );
}

function ReverseDialog({ event, onClose, onConfirm }: { event: JourneyRiskEvent | null; onClose: () => void; onConfirm: (reason: string) => Promise<JourneyActionResponse> }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <DsDialog open={Boolean(event)} onOpenChange={(open) => { if (!open) { onClose(); setReason(""); setError(null); } }}>
      <DsDialogPopup>
        <DsDialogHeader>
          <DsDialogTitle>Estornar {event?.points ?? 0} pts de {event?.brokerName ?? ""}?</DsDialogTitle>
          <DsDialogDescription>O corretor vê o estorno no extrato dele. Diga o motivo com clareza.</DsDialogDescription>
        </DsDialogHeader>
        <label className="block space-y-1.5 px-ds-24"><span className="text-sm font-medium">Motivo</span><DsInputField autoFocus value={reason} maxLength={200} onChange={(change) => setReason(change.target.value)} placeholder="Ex.: contato registrado sem mensagem enviada" /></label>
        {error ? <p role="alert" className="px-ds-24 text-sm text-destructive">{error}</p> : null}
        <DsDialogFooter>
          <DsOutlinedActionButton onClick={onClose}>Voltar</DsOutlinedActionButton>
          <DsFilledDarkCta loading={pending} onClick={() => {
            if (reason.trim().length < 5) { setError("Escreva o motivo (pelo menos 5 letras)."); return; }
            start(async () => { const result = await onConfirm(reason.trim()); if (result.ok) { onClose(); setReason(""); setError(null); } else setError(result.message); });
          }}>Estornar</DsFilledDarkCta>
        </DsDialogFooter>
      </DsDialogPopup>
    </DsDialog>
  );
}
