"use client";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Badge, type BadgeTone } from "@/components/arc/badge/badge";

import { stageLabel } from "./format";
import type { LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

/** Centered identity: avatar, name, stage chip and, for a new lead, the acceptance deadline. */
export function IdentityHeader({ lead, c, mode = "broker" }: { lead: LightLeadDetailData; c: LeadDetailController; mode?: "broker" | "management" }) {
  const { isDistributed, leadStatus, slaRemainingMinutes } = c;
  const tone: BadgeTone = isDistributed ? "info" : leadStatus === "converted" ? "success" : "neutral";

  return (
    <header data-tour="micro-lead-identity" className="arc-venancor flex flex-col items-center gap-3 pt-2 text-center">
      <Avatar name={lead.nome} size="xl" className="light-avatar" />
      <div className="flex min-w-0 max-w-full flex-col items-center gap-1">
        <h1 className="max-w-full break-words text-2xl font-bold tracking-tight text-(--foreground)">{lead.nome}</h1>
        {mode === "management" ? null : isDistributed ? (
          <p className="text-sm text-(--text-secondary)">Os dados de contato aparecem depois que você aceitar o lead.</p>
        ) : lead.email ? (
          <p className="max-w-full truncate text-sm text-(--text-secondary)">{lead.email}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge tone={tone}>{stageLabel(leadStatus)}</Badge>
        {isDistributed && slaRemainingMinutes !== null ? (
          <Badge tone={slaRemainingMinutes <= 5 ? "warning" : "neutral"}>
            <span className="tabular-nums">
              {slaRemainingMinutes <= 0
                ? `Prazo vencido há ${Math.abs(slaRemainingMinutes)} min`
                : `Aceite em até ${slaRemainingMinutes} min`}
            </span>
          </Badge>
        ) : null}
        {!isDistributed && lead.urgency ? <Badge tone="warning">{lead.urgency}</Badge> : null}
      </div>
    </header>
  );
}

/** Everything the client told us (AI qualification and form), before and after acceptance. */
const qualificationLabels: Record<string, string> = {
  pending: "Pendente",
  qualifying: "Em qualificação",
  waiting_human: "Aguardando equipe",
  qualified: "Qualificado",
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
  disqualified: "Desqualificado",
  no_whatsapp_contact: "Sem resposta no WhatsApp",
  meta_blocked: "Bloqueado pelo Meta",
  ia_disabled: "Qualificação manual",
  in_progress: "Em andamento",
  completed: "Concluída",
};

export function ClientInfoCard({ lead, c, mode = "broker" }: { lead: LightLeadDetailData; c: LeadDetailController; mode?: "broker" | "management" }) {
  // Contact data stays hidden until the broker accepts.
  const info = (lead.clientInfo ?? []).filter((item) => !(mode === "management" || c.isDistributed) || item.key !== "email");
  const qualification = lead.qualificationStatus ?? lead.qualificationState;
  const normalizedQualification = qualification?.toLowerCase() ?? "";
  const qualificationLabel = qualification ? qualificationLabels[normalizedQualification] ?? qualification.replaceAll("_", " ") : null;
  if (!info.length && !qualificationLabel) return null;
  return (
    <section aria-labelledby="client-info-heading" className="arc-venancor rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <h2 id="client-info-heading" className="text-base font-semibold text-(--foreground)">
        Informações do cliente
      </h2>
      {qualificationLabel ? <p className="mt-2 text-sm text-(--text-secondary)">Qualificação: <span className="font-medium text-(--foreground)">{qualificationLabel}</span></p> : null}
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {info.map((item) => (
          <div key={item.key} className="min-w-0">
            <dt className="text-sm text-(--text-secondary)">{item.label}</dt>
            <dd className="break-words text-sm font-medium text-(--foreground)">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
