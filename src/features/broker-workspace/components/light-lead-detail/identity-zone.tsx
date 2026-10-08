"use client";

import { Clock, Share } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { type LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

export function IdentityZone({ lead, c }: { lead: LightLeadDetailData; c: LeadDetailController }) {
  const { accepted, slaRemainingMinutes, isDistributed } = c;
  return (
    <>
          {/* Zona A — Identidade e Status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge
              variant={isDistributed ? "warning" : accepted ? "outline" : "secondary"}
              className="text-[11px] font-bold"
            >
              {isDistributed ? "NOVO LEAD" : accepted ? "EM ATENDIMENTO" : "AGUARDANDO"}
            </Badge>

            {/* SLA Countdown ao vivo */}
            {isDistributed && slaRemainingMinutes !== null && (
              <Badge
                variant={slaRemainingMinutes <= 0 ? "destructive" : slaRemainingMinutes <= 5 ? "warning" : "outline"}
                className="text-[10px] font-semibold"
              >
                <Clock className="mr-1 size-3" />
                {slaRemainingMinutes <= 0
                  ? `SLA vencido há ${Math.abs(slaRemainingMinutes)} min`
                  : `Aceite em até ${slaRemainingMinutes} min`}
              </Badge>
            )}

            {!isDistributed && lead.urgency ? (
              <Badge variant="destructive" className="text-[10px] font-semibold">
                <Clock className="mr-1 size-3" />
                {lead.urgency}
              </Badge>
            ) : null}
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{lead.nome}</h1>

            {isDistributed ? (
              <p className="mt-1 text-xs text-muted-foreground italic">
                O número do cliente não é exibido no computador. Aceite o lead e abra o atendimento pelo WhatsApp.
              </p>
            ) : null}

            {!isDistributed && lead.email ? (
              <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Share className="size-3" />
                {lead.email}
              </p>
            ) : null}
          </div>

          {/* Informações do cliente — tudo o que ele informou, antes e depois do aceite */}
          {(() => {
            // Contact data stays hidden until the broker accepts.
            const info = (lead.clientInfo ?? []).filter((item) => !(isDistributed && item.key === "email"));
            return info.length ? (
              <section aria-labelledby="client-info-heading" className="rounded-xl border border-border p-3.5">
                <h2 id="client-info-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Informações do cliente</h2>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                  {info.map((item) => (
                    <div key={item.key} className="min-w-0">
                      <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
                      <dd className="break-words font-semibold text-foreground">{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null;
          })()}
    </>
  );
}
