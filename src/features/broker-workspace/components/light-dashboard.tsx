"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ChatCircleText,
  CheckCircle,
  Clock,
  HelpCircle,
  Lightning,
  SignOut,
  Users,
} from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogPopup,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AncoraLogo } from "@/components/ancora-logo";

import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { cn } from "@/lib/utils";
import { signOut } from "@/shared/auth/client";
import { toast } from "@/components/ui/sonner";
import { LightAvailabilityBanner } from "@/features/broker-workspace/components/light-availability-banner";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getPriorityDetails(nextAction: BrokerWorkspaceData["nextAction"]) {
  if (!nextAction) {
    return {
      urgencyText: "Atendimento em andamento",
      badgeVariant: "secondary" as const,
      badgeLabel: "Em dia",
      btnLabel: "ABRIR",
      btnHref: "/minha-fila",
    };
  }

  const kind = nextAction.kind;
  const leadHref = nextAction.leadId ? `/leads/${nextAction.leadId}` : "/minha-fila";

  switch (kind) {
    case "awaiting_response":
      return {
        urgencyText: "Cliente aguardando sua resposta",
        badgeVariant: "warning" as const,
        badgeLabel: "Responder",
        btnLabel: "VER INSIGHTS",
        btnHref: `/conversas/broker?leadId=${nextAction.leadId}`,
      };
    case "sla_overdue":
      return {
        urgencyText: "SLA vencido — faça o primeiro contato",
        badgeVariant: "destructive" as const,
        badgeLabel: "SLA Vencido",
        btnLabel: "ATENDER AGORA",
        btnHref: leadHref,
      };
    case "sla_risk":
      return {
        urgencyText: "⏱ SLA próximo do limite",
        badgeVariant: "warning" as const,
        badgeLabel: "Urgente",
        btnLabel: "ATENDER AGORA",
        btnHref: leadHref,
      };
    case "new_lead":
      return {
        urgencyText: "🆕 Novo lead aguardando seu aceite",
        badgeVariant: "warning" as const,
        badgeLabel: "Novo Lead",
        btnLabel: "ACEITAR LEAD",
        btnHref: leadHref,
      };
    case "task_overdue":
      return {
        urgencyText: "Tarefa pendente atrasada",
        badgeVariant: "destructive" as const,
        badgeLabel: "Atrasado",
        btnLabel: "VER TAREFA",
        btnHref: leadHref,
      };
    case "return_due":
      return {
        urgencyText: "Retorno agendado para hoje",
        badgeVariant: "warning" as const,
        badgeLabel: "Retorno",
        btnLabel: "VER RETORNO",
        btnHref: leadHref,
      };
    case "proposal_pending":
      return {
        urgencyText: "Cotação aguardando acompanhamento",
        badgeVariant: "secondary" as const,
        badgeLabel: "Cotação",
        btnLabel: "RETOMAR COTAÇÃO",
        btnHref: leadHref,
      };
    case "document_pending":
      return {
        urgencyText: "Documentação pendente para envio",
        badgeVariant: "warning" as const,
        badgeLabel: "Documentos",
        btnLabel: "VER DOCUMENTOS",
        btnHref: leadHref,
      };
    case "follow_up_stalled":
      return {
        urgencyText: "⏸ Negociação sem contato recente",
        badgeVariant: "secondary" as const,
        badgeLabel: "Retomar",
        btnLabel: "RETOMAR",
        btnHref: leadHref,
      };
    default:
      return {
        urgencyText: "Ação necessária no lead",
        badgeVariant: "outline" as const,
        badgeLabel: "Ação",
        btnLabel: "VER LEAD",
        btnHref: leadHref,
      };
  }
}

export function LightDashboard({
  data,
  logoUrl,
}: {
  data: BrokerWorkspaceData;
  logoUrl?: string | null;
}) {
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const firstName = data.viewer.name.split(" ")[0] || "Corretor";
  const greeting = getGreeting();

  async function handleLogout() {
    setLoggingOut(true);
    toast.info("Encerrando sua sessão...");
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/login";
          },
        },
      });
    } catch {
      // signOut may fail if server is unreachable
    } finally {
      window.location.href = "/login";
    }
  }

  const awaitingResponse = data.today.awaitingResponse;
  const inService = data.queue.filter((q) => q.status === "in_contact").length;
  const pendingUpdate = data.today.returnsDue + data.today.overdueTasks;

  const topAction = data.nextAction;
  const topQueueLead = data.queue[0];
  const priorityInfo = getPriorityDetails(topAction);

  const hasNextAction = Boolean(topAction || topQueueLead);
  const nextLeadName = topAction?.title || topQueueLead?.name || "Atendimento prioritário";
  const nextLeadDesc = topAction?.description || (topQueueLead?.status === "distributed" ? "Lead aguardando seu primeiro contato" : "Aguardando continuidade no funil");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Banner de status quando pausado ou offline */}
      <LightAvailabilityBanner initialStatus={data.viewer.availabilityStatus} />

      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 pb-28 sm:px-6 flex-1">
        {/* Header: tenant logo + status + buttons */}
        <header className="flex items-center justify-between gap-3">
          <AncoraLogo src={logoUrl} className="h-9 w-auto max-w-[180px] object-contain" />
          <div className="flex items-center gap-2">
            {data.viewer.availabilityStatus !== "available" && (
              <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                ⏸ Pausado
              </span>
            )}
            <button
              type="button"
              aria-label="Reportar problema"
              title="Reportar problema"
              onClick={() => window.dispatchEvent(new CustomEvent("open-system-feedback"))}
              className="grid size-9 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-xs transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <HelpCircle className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Sair da conta"
              title="Sair da conta"
              onClick={() => setLogoutConfirmOpen(true)}
              disabled={loggingOut}
              className="grid size-9 place-items-center rounded-full border border-border/70 bg-card text-muted-foreground shadow-xs transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:pointer-events-none"
            >
              {loggingOut ? (
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <SignOut className="size-4" />
              )}
            </button>
          </div>
        </header>

        {/* Dialog de confirmação de logout */}
        <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
          <DialogPopup className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Sair da conta?</DialogTitle>
              <DialogDescription>
                Você será desconectado e redirecionado para a tela de login.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={loggingOut}>
                    Cancelar
                  </Button>
                }
              />
              <Button
                type="button"
                variant="destructive"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saindo…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <SignOut className="size-4" />
                    Sair
                  </span>
                )}
              </Button>
            </DialogFooter>
          </DialogPopup>
        </Dialog>

        {/* Bloco 1 — Seu próximo lead agora (um único lead, uma única decisão) */}
        <section aria-label="Seu próximo atendimento" className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {greeting}, {firstName}
            </h1>
          </div>

          {hasNextAction ? (
            <Card
              variant="subtle"
              className="p-5 sm:p-6 bg-gradient-to-br from-primary/[0.08] via-card to-card border-primary/20 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Seu próximo lead agora
                </span>
                <Badge variant={priorityInfo.badgeVariant} className="text-[10px] font-bold">
                  {priorityInfo.badgeLabel}
                </Badge>
              </div>

              <div>
                <p className="text-xs font-semibold text-foreground">{priorityInfo.urgencyText}</p>
                <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {nextLeadName}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {nextLeadDesc}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <Link
                  href={priorityInfo.btnHref}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "flex-1 font-bold gap-2 text-xs shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 h-11",
                  )}
                >
                  <Lightning className="size-4" />
                  {priorityInfo.btnLabel}
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/minha-fila"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "font-semibold text-xs h-11",
                  )}
                >
                  Ver minha fila
                </Link>
              </div>
            </Card>
          ) : (
            <Card
              variant="subtle"
              className="flex flex-col items-center justify-center p-8 text-center bg-card/95 border-dashed"
            >
              <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <CheckCircle className="size-6" />
              </div>
              <h2 className="mt-3 text-base font-semibold text-foreground">Tudo em dia!</h2>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground leading-relaxed">
                Você não tem nenhuma ação pendente no momento. Quando chegar um novo lead, ele
                aparecerá aqui.
              </p>
              <div className="mt-4">
                <Link
                  href="/minha-fila"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "text-xs font-medium",
                  )}
                >
                  Ver todos os meus leads
                </Link>
              </div>
            </Card>
          )}
        </section>

        {/* Bloco 2 — Resumo Operacional Compacto */}
        <section aria-label="Resumo operacional" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/minha-fila?filter=awaiting"
              className="group rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-primary/40 block"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Lightning className="size-4" />
                </span>
                <Badge
                  variant={awaitingResponse > 0 ? "warning" : "outline"}
                  className="text-[11px] font-bold"
                >
                  {awaitingResponse}
                </Badge>
              </div>
              <strong className="mt-3 block text-2xl font-bold tabular-nums text-foreground">
                {awaitingResponse}
              </strong>
              <p className="mt-0.5 text-xs font-medium text-foreground">Aguardando resposta</p>
              <p className="text-[11px] text-muted-foreground">Leads com nova mensagem</p>
            </Link>

            <Link
              href="/minha-fila?filter=active"
              className="group rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-primary/40 block"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-4" />
                </span>
                <Badge variant="outline" className="text-[11px] font-bold">
                  {inService}
                </Badge>
              </div>
              <strong className="mt-3 block text-2xl font-bold tabular-nums text-foreground">
                {inService}
              </strong>
              <p className="mt-0.5 text-xs font-medium text-foreground">Em atendimento</p>
              <p className="text-[11px] text-muted-foreground">Em negociação ativa</p>
            </Link>

            <Link
              href="/minha-fila"
              className="group rounded-xl border border-border/70 bg-card p-4 shadow-xs transition-colors hover:border-primary/40 block"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </span>
                <Badge
                  variant={pendingUpdate > 0 ? "destructive" : "outline"}
                  className="text-[11px] font-bold"
                >
                  {pendingUpdate}
                </Badge>
              </div>
              <strong className="mt-3 block text-2xl font-bold tabular-nums text-foreground">
                {pendingUpdate}
              </strong>
              <p className="mt-0.5 text-xs font-medium text-foreground">Aguardando atualização</p>
              <p className="text-[11px] text-muted-foreground">Tarefas e retornos pendentes</p>
            </Link>
          </div>

          {/* Meta Individual (uma linha, sem exibir valores financeiros confidenciais) */}
          {data.goal && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Sua meta do mês · {data.goal.name}
                </span>
                <span className="font-bold text-primary tabular-nums">
                  {Math.round(data.goal.percentage)}% concluída
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(data.goal.percentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Fila rápida de próximas ações secundárias */}
        {data.queue.length > 1 && (
          <section aria-label="Outros atendimentos" className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Outros em andamento
              </h2>
              <Link
                href="/minha-fila"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todos ({data.queue.length})
              </Link>
            </div>

            <div className="space-y-2">
              {data.queue.slice(1, 4).map((item) => {
                const isNew = item.status === "distributed";
                return (
                  <Link
                    key={item.id}
                    href={`/leads/${item.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <strong className="block text-xs font-bold text-foreground truncate">
                        {item.name}
                      </strong>
                      <span className="text-[11px] text-muted-foreground">
                        {isNew ? "Novo lead aguardando aceite" : "Em atendimento"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={isNew ? "warning" : "secondary"}
                        className="text-[9px] font-bold"
                      >
                        {isNew ? "NOVO" : "ABRIR"}
                      </Badge>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
