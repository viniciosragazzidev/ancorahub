"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle, Warning } from "@/components/huge-icons";
import { Card } from "@/components/ui/card";
import { type LightLeadDetailData } from "./types";
import { formatDateTime } from "./format";
import type { LeadDetailController } from "./use-lead-detail";

export function LeadTopSection({ lead, c, brokerName }: { lead: LightLeadDetailData; c: LeadDetailController; brokerName: string }) {
  const { saleSuccessAnim } = c;
  return (
    <>
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
          <Link
            href="/minha-fila"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Meus Leads
          </Link>
          <span className="text-[11px] text-muted-foreground">
            Responsável: {lead.corretorNome || brokerName}
          </span>
        </div>

        {lead.redistributionNotice ? (
          <Card variant="subtle" className="border-amber-300/70 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
            <div className="flex items-start gap-3 text-left">
              <div className="mt-0.5 rounded-full bg-amber-100 p-1.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <Warning className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Lead redistribuído</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800/90 dark:text-amber-100/80">
                  Este lead foi redistribuído para outro corretor{lead.redistributionNotice.reason ? `: ${lead.redistributionNotice.reason}` : "."}
                </p>
                <time className="mt-2 block text-[11px] text-amber-800/70 dark:text-amber-200/60" dateTime={String(lead.redistributionNotice.createdAt)}>
                  {formatDateTime(lead.redistributionNotice.createdAt)}
                </time>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Sale Success Victory Animation Banner */}
        {saleSuccessAnim ? (
          <Card
            variant="subtle"
            className="p-4 bg-primary/10 border-primary/30 text-center space-y-2 animate-in fade-in zoom-in duration-300"
          >
            <div className="mx-auto grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
              <CheckCircle className="size-6" />
            </div>
            <h2 className="text-base font-bold text-primary">✓ Venda registrada!</h2>
            <p className="text-xs text-muted-foreground">
              O atendimento foi concluído e registrado como venda realizada.
            </p>
          </Card>
        ) : null}
    </>
  );
}
