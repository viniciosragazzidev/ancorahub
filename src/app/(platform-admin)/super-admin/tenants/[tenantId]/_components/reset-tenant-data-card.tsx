"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, CheckmarkCircle02Icon, Delete02Icon, Loading02Icon, ShieldKeyIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogPopup,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/core/cn";

type PurgeJobStatus = {
  status: string;
  totalLeads: number | null;
  deletedLeads: number | null;
  totalConversations: number | null;
  deletedConversations: number | null;
  currentPhase: string | null;
  error: string | null;
  completedAt: Date | null;
};

const PHASE_LABELS: Record<string, string> = {
  starting: "Preparando...",
  outboxes: "Limpando filas de envio...",
  ai_logs: "Removendo logs de IA...",
  notifications: "Removendo notificações...",
  interactions: "Removendo interações...",
  documents: "Removendo documentos...",
  sales: "Removendo vendas e comissões...",
  marketing: "Removendo dados de marketing...",
  tasks: "Removendo tarefas...",
  quotes: "Removendo cotações...",
  clients: "Removendo clientes...",
  leads: "Removendo leads...",
  completed: "Concluído!",
  failed: "Falha",
};

export function ResetTenantDataCard({
  tenantId,
  tenantName,
  action,
  getPurgeStatus,
}: {
  tenantId: string;
  tenantName: string;
  action: (formData: FormData) => Promise<{ jobId: string; started: boolean }>;
  getPurgeStatus: (jobId: string) => Promise<PurgeJobStatus>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();
  const [purgeJobId, setPurgeJobId] = useState<string | null>(null);
  const [purgeStatus, setPurgeStatus] = useState<PurgeJobStatus | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const startPolling = useCallback(
    (jobId: string) => {
      setPurgeJobId(jobId);
      pollRef.current = setInterval(async () => {
        try {
          const status = await getPurgeStatus(jobId);
          setPurgeStatus(status);
          if (status.status === "completed" || status.status === "failed") {
            stopPolling();
            if (status.status === "completed") {
              toast.success(
                `Purge concluído! ${status.deletedLeads ?? 0} leads e ${status.deletedConversations ?? 0} conversas removidos.`,
              );
              setOpen(false);
            } else {
              toast.error(`Purge falhou: ${status.error ?? "Erro desconhecido"}`);
            }
          }
        } catch {
          // Polling error — ignore, will retry
        }
      }, 2000);
    },
    [getPurgeStatus, stopPolling],
  );

  const handleReset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (confirmation !== "RESET") {
      toast.error('Digite "RESET" exatamente como solicitado para confirmar.');
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("tenantId", tenantId);
        formData.append("confirmation", confirmation);

        const result = await action(formData);
        toast.info("Purge iniciado! A operação roda em background.");
        startPolling(result.jobId);
        setConfirmation("");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao resetar dados da empresa.";
        toast.error(message);
      }
    });
  };

  return (
    <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={Delete02Icon} className="size-5 text-destructive" />
            <CardTitle className="text-base text-destructive">Zerar Leads e Mensagens</CardTitle>
          </div>
          <Badge variant="destructive" className="text-[10px]">
            Super Admin
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Reseta os leads, qualificações e conversas de <strong>{tenantName}</strong> para dar início a uma nova campanha do zero.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-lg border border-destructive/20 bg-background/60 p-3 text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <HugeiconsIcon icon={ShieldKeyIcon} className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>O que será MANTIDO (preservado):</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
            <li>Toda a equipe (Diretores, Gestores e Corretores)</li>
            <li>Filiais e regras de distribuição</li>
            <li>Canais e conexões WhatsApp / WABA ativos</li>
            <li>Configurações de IA e comportamentos</li>
            <li>Integrações Meta, Anúncios e Páginas</li>
            <li>Cargos e permissões personalizadas</li>
          </ul>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="destructive" className="w-full sm:w-auto text-xs gap-1.5" />}>
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            Resetar Leads, Conversas e Qualificações
          </DialogTrigger>

          <DialogPopup className="sm:max-w-md">
            <form onSubmit={handleReset}>
              <DialogHeader>
                <div className="flex items-center gap-2 text-destructive">
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-5" />
                  <DialogTitle>Confirmar Reset da Operação</DialogTitle>
                </div>
                <DialogDescription className="text-xs pt-1">
                  Esta operação apagará <strong>PERMANENTEMENTE</strong> todos os leads, qualificações, conversas de WhatsApp, notas e propostas vinculadas a <strong>{tenantName}</strong>.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-3">
                {purgeStatus && purgeStatus.status !== "completed" && purgeStatus.status !== "failed" ? (
                  /* ── Progress View ── */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin text-primary" />
                      <span className="text-sm font-semibold">Purge em andamento...</span>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground">
                        {PHASE_LABELS[purgeStatus.currentPhase ?? ""] ?? purgeStatus.currentPhase}
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-500"
                          style={{
                            width: `${purgeStatus.totalLeads
                              ? Math.min(100, Math.round(((purgeStatus.deletedLeads ?? 0) / purgeStatus.totalLeads) * 100))
                              : 0}%`,
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {purgeStatus.deletedLeads ?? 0} / {purgeStatus.totalLeads ?? "?"} leads · {purgeStatus.deletedConversations ?? 0} / {purgeStatus.totalConversations ?? "?"} conversas
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      A operação roda em background. Você pode fechar este diálogo e continuar usando o CRM.
                    </p>
                  </div>
                ) : purgeStatus?.status === "completed" ? (
                  /* ── Success View ── */
                  <div className="flex flex-col items-center gap-2 rounded-md bg-emerald-500/10 p-4 text-center">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-8 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Reset Concluído!</p>
                    <p className="text-xs text-muted-foreground">
                      {purgeStatus.deletedLeads ?? 0} leads e {purgeStatus.deletedConversations ?? 0} conversas removidos.
                    </p>
                  </div>
                ) : purgeStatus?.status === "failed" ? (
                  /* ── Error View ── */
                  <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                    <p className="font-semibold">❌ Falha no purge</p>
                    <p>{purgeStatus.error ?? "Erro desconhecido. Tente novamente."}</p>
                  </div>
                ) : (
                  /* ── Confirmation View ── */
                  <>
                    <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive space-y-1">
                      <p className="font-semibold">⚠️ Ação irreversível!</p>
                      <p>A equipe, números de WhatsApp, anúncios Meta e treinamentos de IA permanecerão intactos.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmation-code" className="text-xs">
                        Para confirmar, digite <strong className="text-foreground">RESET</strong> abaixo:
                      </Label>
                      <Input
                        id="confirmation-code"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        placeholder="RESET"
                        autoComplete="off"
                        className="font-mono uppercase text-xs"
                      />
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setOpen(false); stopPolling(); setPurgeStatus(null); }}
                  disabled={isPending && !purgeStatus}
                >
                  {purgeStatus?.status === "running" || purgeStatus?.status === "pending" ? "Fechar" : "Cancelar"}
                </Button>
                {!purgeStatus || purgeStatus.status === "failed" ? (
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={confirmation !== "RESET" || isPending}
                    className="gap-1.5 text-xs"
                  >
                    {isPending ? (
                      <>
                        <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      <>
                        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                        Confirmar Reset Definitivo
                      </>
                    )}
                  </Button>
                ) : null}
              </DialogFooter>
            </form>
          </DialogPopup>
        </Dialog>
      </CardContent>
    </Card>
  );
}
