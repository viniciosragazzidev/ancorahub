"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle, Clock, HelpCircle, Lightning, SignOut, Users } from "@/components/huge-icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogPopup, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AncoraLogo } from "@/components/ancora-logo";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { cn } from "@/lib/utils";
import { signOut } from "@/shared/auth/client";
import { toast } from "sonner";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
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

  const hasActionableItems = data.queue.length > 0 || Boolean(data.nextAction);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 pb-24 sm:px-6">
      {/* Header: tenant logo + mode toggle */}
      <header className="flex items-center justify-between gap-3">
        <AncoraLogo src={logoUrl} className="h-9 w-auto max-w-[180px] object-contain" />
        <div className="flex items-center gap-2">
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
            {loggingOut ? <span className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <SignOut className="size-4" />}
          </button>
          <ExperienceModeToggle variant="badge" />
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
            <DialogClose render={<Button type="button" variant="outline" disabled={loggingOut}>Cancelar</Button>} />
            <Button type="button" variant="destructive" onClick={handleLogout} disabled={loggingOut}>
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

      {/* Primary Question: Tenho algo para fazer agora? */}
      <section aria-label="Resumo do dia" className="space-y-4">
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 shadow-xs sm:p-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {greeting}, {firstName}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Tenho algo para fazer agora?</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Lightning className="size-4" />
                </span>
                <Badge variant={awaitingResponse > 0 ? "warning" : "outline"} className="text-[11px] font-bold">
                  {awaitingResponse}
                </Badge>
              </div>
              <strong className="mt-3 block text-3xl font-bold tabular-nums text-foreground">{awaitingResponse}</strong>
              <p className="mt-1 text-xs font-medium text-foreground">Aguardando resposta</p>
              <p className="text-[11px] text-muted-foreground">Leads com nova mensagem</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-4" />
                </span>
                <Badge variant="outline" className="text-[11px] font-bold">
                  {inService}
                </Badge>
              </div>
              <strong className="mt-3 block text-3xl font-bold tabular-nums text-foreground">{inService}</strong>
              <p className="mt-1 text-xs font-medium text-foreground">Em atendimento</p>
              <p className="text-[11px] text-muted-foreground">Em negociação ativa</p>
            </div>

            <div className="rounded-xl border border-border/70 bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </span>
                <Badge variant={pendingUpdate > 0 ? "destructive" : "outline"} className="text-[11px] font-bold">
                  {pendingUpdate}
                </Badge>
              </div>
              <strong className="mt-3 block text-3xl font-bold tabular-nums text-foreground">{pendingUpdate}</strong>
              <p className="mt-1 text-xs font-medium text-foreground">Aguardando atualização</p>
              <p className="text-[11px] text-muted-foreground">Tarefas e retornos pendentes</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link
              href="/minha-fila?filter=awaiting"
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto font-semibold gap-2 shadow-sm")}
            >
              <Lightning className="size-4" />
              VER LEADS AGUARDANDO
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/minha-fila"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full sm:w-auto font-medium")}
            >
              Ver meus leads
            </Link>
          </div>
        </div>
      </section>

      {/* Próximas Ações */}
      <section aria-label="Próximas ações" className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Próximas ações</h2>

        {hasActionableItems ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.queue.slice(0, 4).map((item) => {
              const nextKind = item.nextAction?.kind;
              const isNew = item.status === "distributed" || nextKind === "new_lead";
              const isAwaiting = nextKind === "awaiting_response";
              const isOverdue = nextKind === "task_overdue" || nextKind === "sla_overdue";
              const summaryText = item.nextAction?.description || (item.status === "distributed" ? "Novo lead aguardando aceite" : "Em atendimento");

              return (
                <Card key={item.id} variant="subtle" className="flex flex-col justify-between p-4 bg-card/95 hover:border-primary/30 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={isNew ? "warning" : isOverdue ? "destructive" : "secondary"}
                        className="text-[10px] font-semibold"
                      >
                        {isNew ? "Novo lead" : isAwaiting ? "Aguardando sua resposta" : isOverdue ? "Atualização pendente" : "Em atendimento"}
                      </Badge>
                    </div>
                    <h3 className="text-base font-semibold text-foreground truncate">{item.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{summaryText}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" />
                      {isNew ? "Aguardando aceite" : "Atualizar hoje"}
                    </span>
                    <Button
                      size="sm"
                      render={<Link href={`/leads/${item.id}`} />}
                      className="h-8 px-3 text-xs font-semibold gap-1"
                    >
                      {isNew ? "ABRIR" : "ATUALIZAR"}
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Estado Vazio Tranquilo - Sem confete, sem exagero */
          <Card variant="subtle" className="flex flex-col items-center justify-center p-8 text-center bg-card/95 border-dashed">
            <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle className="size-6" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">Tudo certo por aqui</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground leading-relaxed">
              Você não tem nenhuma ação pendente no momento. Assim que receber um novo lead, ele aparecerá aqui.
            </p>
            <div className="mt-4">
              <Link
                href="/minha-fila"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs font-medium")}
              >
                Ver todos os meus leads
              </Link>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
