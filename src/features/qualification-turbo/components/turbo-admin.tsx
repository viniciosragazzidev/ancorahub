"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GearSix, PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";

import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

import { submitRecommendedTemplatesAction, updateTurboSettingsAction, type TurboAdminData } from "../actions";

const TOUCH_LABEL: Record<string, string> = {
  t0: "1ª mensagem",
  t1: "Lembrete 20 min",
  t2: "Reengajamento 3h",
  t3: "Oferta de ligação",
  t4: "Despedida",
  reactivation: "Reativação",
};

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  APPROVED: { label: "Aprovado", variant: "success" },
  PENDING: { label: "Em análise na Meta", variant: "warning" },
  REJECTED: { label: "Rejeitado", variant: "destructive" },
  PAUSED: { label: "Pausado pela Meta", variant: "destructive" },
  DISABLED: { label: "Desativado", variant: "destructive" },
  MISSING: { label: "Não enviado", variant: "secondary" },
};

function categoryLabel(category: string | null) {
  if (!category) return "";
  return category.toUpperCase() === "MARKETING" ? "Marketing" : category.toUpperCase() === "UTILITY" ? "Utilidade" : category;
}

function SettingRow({ title, description, checked, onChange, disabled }: { title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[var(--radius-card)] border border-border p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function SettingsSheet({ data }: { data: TurboAdminData }) {
  const [settings, setSettings] = useState(data.settings);
  const [isPending, startTransition] = useTransition();
  const save = (next: typeof settings) => {
    setSettings(next);
    startTransition(async () => {
      const result = await updateTurboSettingsAction(next);
      if (result.success) toast.success("Configuração salva.");
      else {
        setSettings(data.settings);
        toast.error(result.error ?? "Não foi possível salvar.");
      }
    });
  };
  const disabled = !data.canEdit || isPending;
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <GearSix aria-hidden="true" /> Configurações
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Qualificação turbo</SheetTitle>
          <SheetDescription>Primeira mensagem por tipo de anúncio, testes A/B e lembretes automáticos.</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          <SettingRow
            title="Primeira mensagem inteligente"
            description="Escolhe a mensagem pelo tipo de anúncio e testa variantes. Desligado, volta ao template configurado em Atendimento."
            checked={settings.enabled}
            disabled={disabled}
            onChange={(value) => save({ ...settings, enabled: value })}
          />
          <SettingRow
            title="Lembretes automáticos"
            description="Para quem não respondeu: 20 min, 3h, no dia seguinte e despedida em 3 dias, só entre 8h e 20h."
            checked={settings.cadence}
            disabled={disabled || !settings.enabled}
            onChange={(value) => save({ ...settings, cadence: value })}
          />
          <SettingRow
            title="Aprender sozinho"
            description="Depois de 50 envios por variante, usa mais a mensagem que tem mais respostas e segue testando 10%."
            checked={settings.learn}
            disabled={disabled || !settings.enabled}
            onChange={(value) => save({ ...settings, learn: value })}
          />
          <label className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-border p-3">
            <span className="text-sm font-medium">Nome da empresa nas mensagens</span>
            <span className="text-xs leading-5 text-muted-foreground">Vazio usa o nome cadastrado em Configurações › Empresa.</span>
            <Input
              defaultValue={settings.companyDisplayName}
              maxLength={60}
              disabled={disabled}
              placeholder="Ex.: Âncora Saúde"
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== settings.companyDisplayName) save({ ...settings, companyDisplayName: value });
              }}
            />
          </label>
          {!data.canEdit ? <p className="text-xs text-muted-foreground">Só o diretor altera estas opções.</p> : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

export function TurboAdmin({ data }: { data: TurboAdminData }) {
  const [isPending, startTransition] = useTransition();
  const missing = data.templates.filter((row) => row.status === "MISSING" || row.status === "REJECTED");
  const approved = data.templates.filter((row) => row.status === "APPROVED").length;

  const submit = () => {
    startTransition(async () => {
      const result = await submitRecommendedTemplatesAction();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.submitted.length) toast.success(`${result.submitted.length} templates enviados para aprovação da Meta.`);
      if (result.failed.length) toast.error(`${result.failed.length} não foram aceitos: ${result.failed.map((item) => item.name).join(", ")}.`);
      if (!result.submitted.length && !result.failed.length) toast.info("Todos os templates já estão na Meta.");
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Card variant="overview">
        <SectionCardHeader
          icon={<Sparkle />}
          title="Templates da qualificação"
          badge={<Badge variant={approved === data.templates.length ? "success" : "secondary"}>{approved} de {data.templates.length} aprovados</Badge>}
          description="Primeira mensagem e lembrete são utilidade (R$ 0,035); reengajamento é marketing (R$ 0,32). Cada botão já responde uma pergunta ou encerra a sequência. Templates ainda não aprovados são pulados sem afetar o atendimento."
          actions={
            <div className="flex items-center gap-2">
              <SettingsSheet data={data} />
              {data.canEdit ? (
                <Button onClick={submit} disabled={isPending || !missing.length || !data.metaConnected} variant="deep-sapphire" size="sm" className="gap-1.5">
                  <PaperPlaneTilt aria-hidden="true" />
                  {isPending ? "Enviando..." : missing.length ? `Enviar ${missing.length} à Meta` : "Todos enviados"}
                </Button>
              ) : null}
            </div>
          }
        />
        {!data.metaConnected ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Conecte o número oficial da Meta em Integrações › WhatsApp para enviar os templates.</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Mensagem</th>
                <th className="px-4 py-2 font-medium">Quando</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 font-medium">Na Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.templates.map((row) => {
                const status = STATUS[row.status] ?? { label: row.status, variant: "secondary" as const };
                const recategorized = row.category && row.category.toUpperCase() !== row.expectedCategory;
                return (
                  <tr key={row.name} className="align-top">
                    <td className="max-w-md px-4 py-3">
                      <span className="block font-medium text-foreground">{row.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{row.body}</span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {row.buttons.map((button) => <span key={button} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{button}</span>)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{TOUCH_LABEL[row.touch] ?? row.touch}</td>
                    <td className="px-4 py-3">
                      <span className="block">{categoryLabel(row.category ?? row.expectedCategory)}</span>
                      {recategorized ? <span className="block text-xs text-destructive">A Meta mudou a categoria</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {row.rejectedReason ? <span className="mt-1 block text-xs text-muted-foreground">{row.rejectedReason}</span> : null}
                      {row.quality && row.quality.toUpperCase() !== "GREEN" && row.quality.toUpperCase() !== "UNKNOWN" ? <span className="mt-1 block text-xs text-destructive">Qualidade {row.quality.toLowerCase()}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">
        Os resultados (quem respondeu, qual mensagem funciona melhor, custo) ficam em{" "}
        <Link href="/dashboard?tab=funnel" className="font-medium text-primary underline-offset-4 hover:underline">Painel › Funil de qualificação</Link>.
      </p>
    </div>
  );
}
