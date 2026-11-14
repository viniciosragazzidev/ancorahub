"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, CalendarDays, CalendarX2, Clock3, MapPin, MonitorSmartphone } from "lucide-react";

import { Badge } from "@/components/arc/badge/badge";
import { Button } from "@/components/arc/button/button";
import buttonStyles from "@/components/arc/button/button.module.css";
import { EmptyState } from "@/components/arc/empty-state/empty-state";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import "@/components/arc/venancor-scope.css";
import { LitePageEnter, LiteSwap } from "@/components/lite/motion";
import { cn } from "@/lib/utils";
import type { BrokerDutyCalendarResult } from "../duty-calendar";
import type { DutyHubCurrent, DutyHubShift } from "../duty-hub";
import { DUTY_CARD_STYLE, DutyCalendarSections } from "./light-duty-calendar";

export type BrokerDutyHubProps = {
  current: DutyHubCurrent;
  calendar: BrokerDutyCalendarResult | null;
  /** disabled: o calendário está desligado pelo Super-admin; error: não carregou. */
  calendarState: "ready" | "disabled" | "error";
};

function useRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return { pending, retry: () => startTransition(() => router.refresh()) };
}

/**
 * Plantões em uma entrada única (plano do modo corretor, etapa 3): o plantão atual, o calendário e a escala
 * do corretor numa só página. Só apresenta; abrir o plantão leva à operação em `/plantoes/agora`.
 */
export function BrokerDutyHub({ current, calendar, calendarState }: BrokerDutyHubProps) {
  const card = <CurrentDutyCard current={current} />;
  return (
    <section aria-labelledby="duty-hub-title" className="lite-page" style={{ paddingBottom: "max(120px, var(--mobile-safe-bottom, 0px))" }}>
      <LitePageEnter>
        <header>
          <h1 id="duty-hub-title" className="lite-page-title">Plantões</h1>
        </header>
        {calendarState === "ready" && calendar ? (
          <DutyCalendarSections calendar={calendar} hub={{ current: card, coveredOccurrenceIds: current.coveredOccurrenceIds }} />
        ) : (
          <div className="mt-6 space-y-6">
            {card}
            {calendarState === "error" ? <CalendarUnavailable /> : null}
          </div>
        )}
      </LitePageEnter>
    </section>
  );
}

function CurrentDutyCard({ current }: { current: DutyHubCurrent }) {
  const [selectedKey, setSelectedKey] = useState(current.shifts[0]?.key ?? "");
  const shift = current.shifts.find((item) => item.key === selectedKey) ?? current.shifts[0];

  return (
    <section data-tour="micro-duty-highlight" aria-labelledby="current-duty-title" className="p-4 sm:p-5" style={DUTY_CARD_STYLE}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="current-duty-title" className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Seu plantão atual</h2>
        {current.state === "active" ? <Badge tone="success" size="sm" className="shrink-0">Em andamento</Badge> : null}
      </div>

      {current.state === "error" ? <CurrentDutyError /> : null}

      {current.state === "none" ? (
        <EmptyState
          className="py-6"
          label="Você não tem plantão marcado"
          icon={<CalendarDays width={24} height={24} strokeWidth={1.5} />}
          title="Você não tem plantão marcado"
          description="Quando o supervisor colocar você na escala, o plantão aparece aqui e as datas ficam marcadas no calendário."
        />
      ) : null}

      {current.state === "active" && current.shifts.length > 1 ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Você está em {current.shifts.length} plantões agora. Escolha qual abrir.
          </p>
          <SegmentedControl
            label="Escolha o plantão"
            value={shift?.key ?? ""}
            onValueChange={setSelectedKey}
            options={current.shifts.map((item) => ({ value: item.key, label: item.scheduleName }))}
          />
        </div>
      ) : null}

      {current.state === "next" ? (
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Você não está de plantão agora.</p>
      ) : null}

      {shift && (current.state === "active" || current.state === "next") ? (
        <LiteSwap swapKey={shift.key}>
          <ShiftDetails shift={shift} />
        </LiteSwap>
      ) : null}
    </section>
  );
}

function ShiftDetails({ shift }: { shift: DutyHubShift }) {
  const ModalityIcon = shift.modality === "Presencial" ? Building2 : MonitorSmartphone;
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="min-w-0 truncate text-lg font-semibold" style={{ color: "var(--foreground)" }}>{shift.scheduleName}</h3>
        <Badge tone={shift.situation.tone} size="sm" className="shrink-0">{shift.situation.label}</Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Horário</dt>
          <Clock3 className="size-4 shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
          <dd className="tabular-nums">{shift.dateLabel}, {shift.timeLabel}</dd>
        </div>
        {shift.place ? (
          <div className="flex min-w-0 items-center gap-2">
            <dt className="sr-only">Local</dt>
            <MapPin className="size-4 shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
            <dd className="truncate">{shift.place}</dd>
          </div>
        ) : null}
        {shift.modality ? (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Modalidade</dt>
            <ModalityIcon className="size-4 shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
            <dd>{shift.modality}</dd>
          </div>
        ) : null}
      </dl>
      {shift.hint ? <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>{shift.hint}</p> : null}
      {shift.href ? (
        <Link href={shift.href} className={cn(buttonStyles.button, buttonStyles.primary, buttonStyles.md, "mt-4 w-full sm:w-auto")}>
          Abrir plantão
        </Link>
      ) : null}
    </div>
  );
}

function CurrentDutyError() {
  const { pending, retry } = useRetry();
  return (
    <div role="alert" className="mt-3 space-y-3">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Não consegui carregar seu plantão agora. Isso não quer dizer que você está sem escala.
      </p>
      <Button type="button" variant="secondary" size="sm" loading={pending} onClick={retry}>Tentar de novo</Button>
    </div>
  );
}

function CalendarUnavailable() {
  const { pending, retry } = useRetry();
  return (
    <section aria-labelledby="duty-calendar-error-title" className="p-4 sm:p-5" style={DUTY_CARD_STYLE}>
      <div className="flex items-start gap-3">
        <CalendarX2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" style={{ color: "var(--text-muted)" }} />
        <div className="min-w-0 space-y-3" role="alert">
          <h2 id="duty-calendar-error-title" className="text-base font-semibold" style={{ color: "var(--foreground)" }}>Calendário e escala</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Não consegui carregar o calendário e a sua escala. Sua escala continua valendo; tente de novo em instantes.
          </p>
          <Button type="button" variant="secondary" size="sm" loading={pending} onClick={retry}>Tentar de novo</Button>
        </div>
      </div>
    </section>
  );
}
