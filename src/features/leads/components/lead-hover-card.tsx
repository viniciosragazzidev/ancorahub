"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Phone, ShieldCheck, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DsStatusBadge, type DsStatusBadgeStatus } from "@/components/ui/ds-status-badge";
import { HoverPreview } from "@/components/ui/hover-preview";
import { UserAvatar } from "@/components/ui/user-avatar";
import { WhatsappLogo } from "@/components/huge-icons";
import { formatLeadPhone } from "@/features/leads/format-lead-phone";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { formatCurrencyDisplay } from "@/shared/utils/format";
import { buildWhatsAppWebUrl } from "@/lib/whatsapp-url";
import { openWhatsApp } from "@/lib/whatsapp-open";
import { cn } from "@/lib/utils";

/**
 * Hover card do lead (skill `interface-enxuta`, relatório `docs/design-system/referencias/jubayer6910.md` §6).
 * Só no desktop com mouse: ao passar o mouse (ou focar) no nome, abre ao lado do nome com o essencial do lead
 * e os atalhos frequentes, sem abrir o drawer. No toque, o nome segue como antes.
 * Não busca nada no servidor: usa só o que a linha já tem.
 */
export type LeadPreviewData = {
  id: string;
  name: string;
  status?: string | null;
  phone?: string | null;
  /** Operadora / plano / produto, como a lista já mostra. */
  product?: string | null;
  monthlyValue?: string | number | null;
  /** Vidas da proposta. */
  lives?: number | null;
  /** Último movimento conhecido do lead (contato, troca de etapa, atribuição). */
  lastActivityAt?: Date | string | null;
  /** `undefined` = a tela já é do corretor (o campo some); `null` = sem corretor. */
  brokerName?: string | null;
  /** `undefined` = a lista não sabe (o bloco some); `null` = nada agendado. */
  nextAction?: string | null;
  /** Linha curta de contexto: fila, unidade, origem. */
  context?: string | null;
};

const STATUS_TONE: Record<string, DsStatusBadgeStatus> = {
  new: "info",
  distributed: "info",
  in_contact: "secondary",
  quote_sent: "secondary",
  negotiation: "secondary",
  under_analysis: "secondary",
  documentation_pending: "pending",
  awaiting_reply: "pending",
  converted: "success",
  lost: "destructive",
};

export function leadStatusTone(status: string | null | undefined): DsStatusBadgeStatus {
  return (status && STATUS_TONE[status]) || "secondary";
}

/** Etapas do funil na ordem em que avançam (barra de progresso do hover card). */
const PIPELINE: readonly string[] = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
  "converted",
];

/** Posição da etapa no funil: `null` quando a etapa não está nele (perdido, desconhecida). */
export function pipelineStep(status: string | null | undefined): { step: number; total: number } | null {
  const index = status ? PIPELINE.indexOf(status) : -1;
  return index < 0 ? null : { step: index + 1, total: PIPELINE.length };
}

export function formatLastActivity(value: Date | string | null | undefined, now: Date = new Date()): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (now.getTime() - date.getTime() < 60_000) return "agora";
  return formatDistanceToNowStrict(date, { locale: ptBR, addSuffix: true });
}

function phoneDigits(phone: string | null | undefined) {
  return phone ? phone.replace(/\D/g, "") : "";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function livesLabel(lives: number) {
  return lives === 1 ? "1 vida" : `${lives} vidas`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-ds-caption font-medium uppercase tracking-wide text-ds-fog">{children}</p>;
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-ds-4 rounded-ds-tags border border-ds-ash px-ds-8 py-0.5 text-ds-caption text-ds-steel [&_svg]:size-3 [&_svg]:shrink-0 [&_svg]:text-ds-fog">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-ds-caption text-ds-fog">{label}</dt>
      <dd className="mt-0.5 flex min-w-0 items-center gap-ds-4 text-ds-body font-medium text-ds-charcoal">{children}</dd>
    </div>
  );
}

export interface LeadHoverCardContentProps {
  lead: LeadPreviewData;
  /** Abre o drawer da lista (quando a lista tem drawer). */
  onOpen?: () => void;
  /** Página completa do lead (quando não há drawer). */
  href?: string;
}

export function LeadHoverCardContent({ lead, onOpen, href }: LeadHoverCardContentProps) {
  const digits = phoneDigits(lead.phone);
  const statusLabel = lead.status ? LEAD_STATUS_LABELS[lead.status] ?? lead.status : null;
  const hasValue = !(lead.monthlyValue === null || lead.monthlyValue === undefined || lead.monthlyValue === "");
  const step = pipelineStep(lead.status);
  const lives = lead.lives && lead.lives > 0 ? lead.lives : null;

  return (
    <div data-testid="lead-hover-card" aria-label={`Prévia de ${lead.name}`} className="flex flex-col">
      <div className="flex flex-col gap-ds-12 p-ds-16">
        <div className="flex min-w-0 items-start gap-ds-12">
          <UserAvatar
            seed={lead.name}
            name={lead.name}
            className="size-9 shrink-0 rounded-ds-cards border border-ds-ash text-ds-caption font-semibold"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-ds-body-lg font-semibold leading-tight text-ds-charcoal">{lead.name}</p>
            <p className="truncate text-ds-caption text-ds-fog">{lead.context || "Lead"}</p>
          </div>
          {statusLabel ? (
            <DsStatusBadge className="shrink-0" status={leadStatusTone(lead.status)} label={statusLabel} />
          ) : null}
        </div>

        {lead.product || lives ? (
          <div className="flex flex-wrap gap-ds-4">
            {lead.product ? <Chip icon={<ShieldCheck />}>{lead.product}</Chip> : null}
            {lives ? <Chip icon={<Users />}>{livesLabel(lives)}</Chip> : null}
          </div>
        ) : null}

        {step ? (
          <div className="flex items-center gap-ds-12">
            <div className="flex flex-1 gap-ds-4" role="img" aria-label={`Etapa ${step.step} de ${step.total} do funil`}>
              {Array.from({ length: step.total }, (_, index) => (
                <span
                  key={index}
                  className={cn("h-1 flex-1 rounded-ds-tags", index < step.step ? "bg-ds-electric-blue" : "bg-ds-ash")}
                />
              ))}
            </div>
            <span className="shrink-0 text-ds-caption text-ds-fog" aria-hidden>
              Etapa {step.step} de {step.total}
            </span>
          </div>
        ) : null}

        <div className="rounded-ds-cards bg-ds-paper-mist p-ds-12">
          <SectionLabel>Valor mensal</SectionLabel>
          <p className="mt-ds-4 text-ds-heading-sm font-semibold tabular-nums text-ds-charcoal">
            {hasValue ? formatCurrencyDisplay(lead.monthlyValue) : "—"}
          </p>
          <p className="text-ds-caption text-ds-fog">
            {hasValue ? (lives ? `para ${livesLabel(lives)}` : "proposta atual") : "Sem valor de proposta ainda"}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-ds-12">
          {lead.brokerName !== undefined ? (
            <Stat label="Corretor">
              {lead.brokerName ? (
                <>
                  <span
                    aria-hidden
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-ds-tags bg-ds-powder-blue text-[10px] font-semibold text-ds-electric-blue"
                  >
                    {initials(lead.brokerName)}
                  </span>
                  <span className="truncate" title={lead.brokerName}>
                    {lead.brokerName.split(/\s+/)[0]}
                  </span>
                </>
              ) : (
                <span className="truncate text-ds-fog">Sem corretor</span>
              )}
            </Stat>
          ) : null}
          <Stat label="Telefone">
            {lead.phone ? (
              <span className="truncate font-ds-mono text-ds-caption">{formatLeadPhone(lead.phone)}</span>
            ) : (
              "—"
            )}
          </Stat>
          <Stat label="Último movimento">
            <span className="truncate">{formatLastActivity(lead.lastActivityAt)}</span>
          </Stat>
        </dl>

        {lead.nextAction !== undefined ? (
          <div className="flex flex-col gap-ds-8 border-t border-ds-ash pt-ds-12">
            <SectionLabel>Próximo passo</SectionLabel>
            <p className="flex items-center gap-ds-8 text-ds-body text-ds-charcoal">
              <CalendarClock aria-hidden className="size-3.5 shrink-0 text-ds-fog" />
              <span className="truncate">{lead.nextAction || "Nenhum retorno agendado"}</span>
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-ds-4 border-t border-ds-ash p-ds-8">
        {digits ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                openWhatsApp(buildWhatsAppWebUrl(digits));
              }}
            >
              <WhatsappLogo weight="fill" />
              WhatsApp
            </Button>
            <Button
              variant="ghost"
              size="sm"
              render={<a href={`tel:${digits}`} onClick={(event) => event.stopPropagation()} />}
            >
              <Phone />
              Ligar
            </Button>
          </>
        ) : null}
        {onOpen ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="ml-auto min-w-28"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
          >
            Abrir ficha
          </Button>
        ) : href ? (
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto min-w-28"
            render={<Link href={href} onClick={(event) => event.stopPropagation()} />}
          >
            Abrir ficha
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export interface LeadNameHoverCardProps extends LeadHoverCardContentProps {
  /** O nome como a lista já mostra (botão, link ou texto). Precisa aceitar foco. */
  children: React.ReactElement;
  disabled?: boolean;
}

/** Envolve o nome do lead: no desktop com mouse, abre a prévia ao lado do nome; no toque, nada muda. */
export function LeadNameHoverCard({ children, disabled, ...content }: LeadNameHoverCardProps) {
  return (
    <HoverPreview trigger={children} disabled={disabled} side="right" align="start" className="w-96">
      <LeadHoverCardContent {...content} />
    </HoverPreview>
  );
}
