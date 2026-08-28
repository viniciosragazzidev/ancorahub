"use client";

import { useEffect, useState, useTransition } from "react";
import { UserCheck, Clock, UserSwitch } from "@/components/huge-icons";
import { RiLoader4Line } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { getLeadAssignmentHistoryAction, type AssignmentHistoryItem } from "@/features/lead-distribution/actions";
import { formatDate } from "@/features/quotes/utils";

function formatActionLabel(event: AssignmentHistoryItem) {
  switch (event.action) {
    case "assigned":
      return event.newOwnerName ? `Atribuído a ${event.newOwnerName}` : "Atribuído a corretor";
    case "reassigned":
      return event.previousOwnerName && event.newOwnerName
        ? `Reatribuído de ${event.previousOwnerName} para ${event.newOwnerName}`
        : event.newOwnerName
        ? `Reatribuído para ${event.newOwnerName}`
        : "Lead reatribuído";
    case "routed_to_unit":
      return event.toBranchName ? `Encaminhado para ${event.toBranchName}` : "Encaminhado para unidade";
    case "returned_to_queue":
      return "Devolvido à fila da unidade";
    case "assignment_recovered":
      return "Atribuição recuperada pelo sistema";
    case "queued":
      return "Adicionado à fila de distribuição";
    default:
      return event.action;
  }
}

export function LeadAssignmentHistory({
  leadId,
  assignedAt,
  corretorNome,
}: {
  leadId: string;
  assignedAt?: string | null;
  corretorNome?: string | null;
}) {
  const [history, setHistory] = useState<AssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    setLoading(true);
    startTransition(async () => {
      const items = await getLeadAssignmentHistoryAction(leadId);
      if (active) {
        setHistory(items);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [leadId]);

  return (
    <div className="space-y-4">
      {/* ─── 1. Data e Horário da Última Atribuição ─── */}
      <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Última Atribuição</p>
              <p className="text-[11px] text-muted-foreground">Data e horário exatos da atribuição</p>
            </div>
          </div>
          {assignedAt ? (
            <Badge variant="secondary" className="font-mono text-[11px] text-primary">
              {formatDate(assignedAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[11px] text-muted-foreground">
              Aguardando atribuição
            </Badge>
          )}
        </div>
        {assignedAt && corretorNome ? (
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-xs">
            <span className="text-muted-foreground">Corretor responsável:</span>
            <span className="font-semibold text-foreground">{corretorNome}</span>
          </div>
        ) : null}
      </div>

      {/* ─── 2. Histórico de Atribuições ─── */}
      <div className="rounded-xl border border-border/60 bg-card p-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
              <UserSwitch className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Histórico de Atribuições</p>
              <p className="text-[11px] text-muted-foreground">Linha do tempo de movimentações</p>
            </div>
          </div>
          {loading || isPending ? (
            <RiLoader4Line className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant="secondary" className="text-[10px] font-mono">
              {history.length} registro(s)
            </Badge>
          )}
        </div>

        {loading || isPending ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Carregando histórico...
          </div>
        ) : history.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Nenhuma movimentação de atribuição registrada ainda.
          </div>
        ) : (
          <div className="mt-3.5 space-y-3">
            {history.map((item, idx) => (
              <div
                key={item.id}
                className={`relative pl-3.5 text-xs transition-colors ${
                  idx !== history.length - 1 ? "border-l-2 border-primary/20 pb-3" : "border-l-2 border-primary/10"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-semibold text-foreground">
                    {formatActionLabel(item)}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatDate(item.createdAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {item.reason ? (
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {item.reason}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                  <span className="capitalize">Origem: {item.source}</span>
                  {item.actorName ? (
                    <>
                      <span>•</span>
                      <span>Por: {item.actorName}</span>
                    </>
                  ) : null}
                  {item.toBranchName ? (
                    <>
                      <span>•</span>
                      <span>Unidade: {item.toBranchName}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
