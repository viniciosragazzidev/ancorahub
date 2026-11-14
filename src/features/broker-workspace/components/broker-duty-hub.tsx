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
import { CaptainBanner } from "@/components/lite/banner/captain-banner";
import hub from "./duty-hub.module.css";

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
          <p className="lite-page-subtitle">
            {calendarState === "disabled" ? "O que está marcado hoje e o próximo plantão." : "O que está marcado hoje, o calendário e a sua escala."}
          </p>
        </header>
        {calendarState === "ready" && calendar ? (
          <DutyCalendarSections calendar={calendar} hub={{ current: card, coveredOccurrenceIds: current.coveredOccurrenceIds }} />
        ) : (
          <div className="mt-6 space-y-6">
            {card}
            {calendarState === "error" ? <CalendarUnavailable /> : null}
          </div>
        )}
        <DutyBanner current={current} />
      </LitePageEnter>
    </section>
  );
}

function CurrentDutyCard({ current }: { current: DutyHubCurrent }) {
  const [selectedKey, setSelectedKey] = useState(current.shifts[0]?.key ?? "");
  const shift = current.shifts.find((item) => item.key === selectedKey) ?? current.shifts[0];

  return (
    <section data-tour="micro-duty-highlight" aria-labelledby="current-duty-title" className={hub.card}>
      <div className={hub.head}>
        <h2 id="current-duty-title" className={hub.headTitle}>Seu plantão atual</h2>
        {current.state === "active" ? <Badge tone="success" size="sm" className="shrink-0">Em andamento</Badge> : null}
      </div>

      {current.state === "error" ? <div className={hub.foot} style={{ paddingTop: 12 }}><CurrentDutyError /></div> : null}

      {current.state === "none" ? (
        <div className={hub.empty}>
          <span className={hub.emptyIcon} aria-hidden="true"><CalendarDays width={26} height={26} strokeWidth={1.6} /></span>
          <p className={hub.emptyTitle}>Você não tem plantão marcado</p>
          <p className={hub.emptyText}>Quando o supervisor colocar você na escala, o plantão aparece aqui e as datas ficam marcadas no calendário.</p>
        </div>
      ) : null}

      {current.state === "active" && current.shifts.length > 1 ? (
        <div className="space-y-2" style={{ padding: "12px 20px 0" }}>
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

      {current.state === "next" ? <p className={hub.note} style={{ paddingTop: 6 }}>Você não está de plantão agora.</p> : null}

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
    <div>
      <div className={hub.top}>
        <p className={hub.name}>
          <span className="min-w-0 truncate">{shift.scheduleName}</span>
          <Badge tone={shift.situation.tone} size="sm" className="shrink-0">{shift.situation.label}</Badge>
        </p>
        <p className={hub.time}>{shift.timeLabel}</p>
      </div>
      <dl className={hub.facts}>
        <div className={hub.fact} data-tone="when">
          <Clock3 aria-hidden="true" />
          <dt>Quando</dt>
          <dd>{shift.dateLabel}</dd>
        </div>
        <div className={hub.fact} data-tone="where">
          <MapPin aria-hidden="true" />
          <dt>Onde</dt>
          <dd>{shift.place ?? "A definir"}</dd>
        </div>
        <div className={hub.fact} data-tone="mode">
          <ModalityIcon aria-hidden="true" />
          <dt>Modalidade</dt>
          <dd>{shift.modality ?? "A definir"}</dd>
        </div>
      </dl>
      {shift.hint || shift.href ? (
        <div className={hub.foot} style={{ paddingTop: 16 }}>
          {shift.hint ? <p className={hub.hint}>{shift.hint}</p> : null}
          {shift.href ? (
            <Link href={shift.href} className={cn(buttonStyles.button, buttonStyles.primary, buttonStyles.md, "w-full sm:w-auto sm:justify-self-start")}>
              Abrir plantão
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Banner do fim de Plantões (14/11/2026): o tom claro e o capitão espiando por cima da borda, diferente do
 * banner azul do Início e da jornada. Uma dica do próximo passo e um atalho para os horários de atendimento.
 */
function DutyBanner({ current }: { current: DutyHubCurrent }) {
  const shift = current.shifts[0];
  const hours = { label: "Ajustar meus horários", href: "/settings?tab=disponibilidade" };
  if (current.state === "active" && shift) {
    return <CaptainBanner className={hub.banner} tone="light" pose="peek" label="Dica do plantão"
      title="Plantão no ar! Quem aceita primeiro recebe mais leads."
      goal={{ value: shift.timeLabel, hint: shift.scheduleName }} action={hours} />;
  }
  if (current.state === "next" && shift) {
    return <CaptainBanner className={hub.banner} tone="light" pose="peek" label="Dica do plantão"
      title={`Seu próximo plantão é ${shift.dateLabel.toLowerCase()}. Fique online uns minutos antes.`}
      goal={{ value: shift.timeLabel, hint: shift.scheduleName }} action={hours} />;
  }
  return <CaptainBanner className={hub.banner} tone="light" pose="peek" label="Dica do plantão"
    title="Ainda sem plantão? Diga quando você atende e fica mais fácil entrar na escala."
    action={{ label: "Informar meus horários", href: hours.href }} />;
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
