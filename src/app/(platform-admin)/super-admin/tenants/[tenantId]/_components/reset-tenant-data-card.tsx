"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Delete02Icon, Loading02Icon, ShieldKeyIcon } from "@hugeicons/core-free-icons";

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

export function ResetTenantDataCard({
  tenantId,
  tenantName,
  action,
}: {
  tenantId: string;
  tenantName: string;
  action: (formData: FormData) => Promise<{ deletedLeadsCount: number; deletedConversationsCount: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

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
        toast.success(
          `Operação concluída! ${result.deletedLeadsCount} leads e ${result.deletedConversationsCount} conversas zerados em ${tenantName}.`
        );
        setOpen(false);
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
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                  Cancelar
                </Button>
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
                      Resetando...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                      Confirmar Reset Definitivo
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogPopup>
        </Dialog>
      </CardContent>
    </Card>
  );
}
