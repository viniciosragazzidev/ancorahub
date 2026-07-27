"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { updateFeedbackSettingsAction } from "../feedback-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { SaveIcon, BadgeCheckIcon } from "@hugeicons/core-free-icons";
import { Loader2Icon } from "@/components/huge-icons";

type Props = {
  feedbackReminderInterval: string;
  feedbackReminderMaxAttempts: number;
  feedbackPushEnabled: boolean;
  feedbackToastEnabled: boolean;
  feedbackRequiredEnabled: boolean;
  maxActiveLeadsLimit: number;
  canEdit: boolean;
};

export function FeedbackTab({
  feedbackReminderInterval,
  feedbackReminderMaxAttempts,
  feedbackPushEnabled,
  feedbackToastEnabled,
  feedbackRequiredEnabled,
  maxActiveLeadsLimit,
  canEdit,
}: Props) {
  const [state, formAction, isPending] = useActionState(
    async (prev: { success: boolean; error?: string }, formData: FormData) => {
      const result = await updateFeedbackSettingsAction(prev, formData);
      if (result.success) {
        toast.success("Configuração de feedback salva!");
      } else {
        toast.error(result.error ?? "Erro ao salvar.");
      }
      return result;
    },
    { success: false },
  );

  return (
    <div className="grid gap-6">
      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Configurações de Atendimento e Distribuição</CardTitle>
              <CardDescription className="mt-1">
                Configure os lembretes de feedback dos leads e o limite de prioridade para a distribuição automática.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Intervalo entre lembretes (minutos)</FieldLabel>
                <Input
                  type="number"
                  name="feedbackReminderInterval"
                  defaultValue={feedbackReminderInterval}
                  min={1}
                  max={1440}
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Define quanto tempo o sistema espera antes de enviar o próximo lembrete. Mínimo 1 minuto, máximo 1440 (24h).
                </p>
              </Field>
              <Field>
                <FieldLabel>Máximo de tentativas</FieldLabel>
                <Input
                  type="number"
                  name="feedbackReminderMaxAttempts"
                  defaultValue={feedbackReminderMaxAttempts}
                  min={1}
                  max={50}
                  disabled={!canEdit}
                />
                <p className="text-xs text-muted-foreground">
                  Após atingir o limite, o lembrete altera o tom para urgente e notifica supervisores. Mínimo 1, máximo 50.
                </p>
              </Field>
            </div>

            <div className="h-px bg-border" />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/20 has-[:disabled]:opacity-60">
                <input
                  type="checkbox"
                  name="feedbackToastEnabled"
                  value="true"
                  defaultChecked={feedbackToastEnabled}
                  disabled={!canEdit}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <div>
                  <p className="text-sm font-medium">Notificação in-app / Toast</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Exibe um toast persistente no canto inferior direito com "Registrar agora" e "Lembrar depois".
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/20 has-[:disabled]:opacity-60">
                <input
                  type="checkbox"
                  name="feedbackPushEnabled"
                  value="true"
                  defaultChecked={feedbackPushEnabled}
                  disabled={!canEdit}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <div>
                  <p className="text-sm font-medium">Push notification</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Envia uma notificação push para o navegador quando o corretor estiver ausente. A capacidade global precisa estar ativa.
                  </p>
                </div>
              </label>
            </div>

            <div className="h-px bg-border" />

            <label className="flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/20 has-[:disabled]:opacity-60">
              <input
                type="checkbox"
                name="feedbackRequiredEnabled"
                value="true"
                defaultChecked={feedbackRequiredEnabled}
                disabled={!canEdit}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <div>
                <p className="text-sm font-medium">Feedback obrigatório</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Quando ativo, o sistema exige que o corretor registre feedback dentro do prazo configurado. Após o vencimento, o SLA é acionado e o lead pode ser redistribuído.
                </p>
              </div>
            </label>

            <div className="h-px bg-border" />

            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">Distribuição automática de leads</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Limite máximo de leads pendentes ou ativos</FieldLabel>
                  <Input
                    type="number"
                    name="maxActiveLeadsLimit"
                    defaultValue={maxActiveLeadsLimit}
                    min={1}
                    max={100}
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-muted-foreground">
                    Corretores que tenham menos leads ativos ou pendentes do que este limite recebem prioridade na distribuição automática. Se todos estiverem acima do limite, o sistema distribui entre todos normalmente.
                  </p>
                </Field>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <Link
                href="/settings/feedback-templates"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <HugeiconsIcon icon={BadgeCheckIcon} size={16} />
                Gerenciar templates de checklist
              </Link>
              {canEdit && (
                <Button type="submit" disabled={isPending}>
                  {isPending ? (
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                  ) : (
                    <HugeiconsIcon icon={SaveIcon} className="mr-2" size={16} />
                  )}
                  Salvar configuração
                </Button>
              )}
            </div>

            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
