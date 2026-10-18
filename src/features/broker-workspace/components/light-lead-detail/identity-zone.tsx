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

export function ClientInfoCard({ lead, c, mode = "broker", withSummary = false }: { lead: LightLeadDetailData; c: LeadDetailController; mode?: "broker" | "management"; /** The AI summary on top (lead screen, where the chat no longer repeats it). */ withSummary?: boolean }) {
  // Contact data stays hidden until the broker accepts.
  const info = (lead.clientInfo ?? []).filter((item) => !(mode === "management" || c.isDistributed) || item.key !== "email");
  const qualification = lead.qualificationStatus ?? lead.qualificationState;
  const normalizedQualification = qualification?.toLowerCase() ?? "";
  // The broker never sees the qualification (Frio, Morno...): management only (Vinicios, 18/10, urgent).
  const qualificationLabel = qualification && mode === "management" ? qualificationLabels[normalizedQualification] ?? qualification.replaceAll("_", " ") : null;
  const summary = withSummary ? lead.summary : null;
  if (!info.length && !qualificationLabel && !summary) return null;
  return (
    <section aria-labelledby="client-info-heading" data-tour="micro-lead-client" className="arc-venancor rounded-3xl bg-(--surface) p-5 shadow-(--shadow-resting)">
      <h2 id="client-info-heading" className="text-base font-semibold text-(--foreground)">
        Informações do cliente
      </h2>
      {summary ? <p className="mt-2 text-sm leading-relaxed text-(--text-secondary)">{summary}</p> : null}
      {qualificationLabel ? <p className="mt-2 text-sm text-(--text-secondary)">Qualificação: <span className="font-medium text-(--foreground)">{qualificationLabel}</span></p> : null}
      {/* Label and value on one line: reads well in a narrow column and in the phone sheet. */}
      {info.length ? (
        <dl className="mt-3 flex flex-col">
          {info.map((item) => (
            <div key={item.key} className="flex min-w-0 items-baseline justify-between gap-4 py-2">
              <dt className="shrink-0 text-sm text-(--text-secondary)">{item.label}</dt>
              <dd className="min-w-0 break-words text-right text-sm font-medium text-(--foreground)">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
