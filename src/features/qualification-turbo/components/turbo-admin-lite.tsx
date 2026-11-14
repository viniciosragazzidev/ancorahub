"use client";

/**
 * Qualificação turbo no visual Lite. Mesmos templates, status, configurações e Server Actions (enviar à Meta e salvar
 * as opções) com as mesmas mensagens; só quem pode editar (`data.canEdit`, como hoje) envia e altera. Templates em
 * lista Lite (cartões no celular) e as configurações no painel lateral.
 *
 * Feedback (FEEDBACK.md, nível 1): cada opção salva confirma no topo das configurações depois do servidor; a falha
 * desfaz a troca e mostra a causa com "Tentar de novo". Enviar à Meta é trabalho externo (a aprovação demora): o
 * resultado da Meta segue no toast, e a falha do envio fica na seção, com "Tentar de novo".
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { Send, Settings } from "lucide-react";

import { Switch } from "@/components/arc/switch/switch";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { AppSelect } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useFeedback } from "@/lib/feedback/use-feedback";

import { submitRecommendedTemplatesAction, updateTurboSettingsAction, type TurboAdminData } from "../actions";
import { ActionNote, BusyLabel, useActionStatus } from "./action-status-lite";
import { SILENCE_FOLLOW_UP_CHANNEL_OPTIONS, SILENCE_FOLLOW_UP_DESCRIPTION } from "./silence-follow-up-copy";

type TemplateRow = TurboAdminData["templates"][number];

const TOUCH_LABEL: Record<string, string> = { t0: "1ª mensagem", t1: "Lembrete 20 min", t2: "Reengajamento 3h", t3: "Oferta de ligação", t4: "Despedida", reactivation: "Reativação" };
const STATUS: Record<string, { label: string; tone?: "success" | "warning" | "danger" }> = {
  APPROVED: { label: "Aprovado", tone: "success" },
  PENDING: { label: "Em análise na Meta", tone: "warning" },
  REJECTED: { label: "Rejeitado", tone: "danger" },
  PAUSED: { label: "Pausado pela Meta", tone: "danger" },
  DISABLED: { label: "Desativado", tone: "danger" },
  MISSING: { label: "Não enviado" },
};

function categoryLabel(category: string | null) {
  if (!category) return "";
  return category.toUpperCase() === "MARKETING" ? "Marketing" : category.toUpperCase() === "UTILITY" ? "Utilidade" : category;
}

function SettingRow({ id, title, description, checked, onChange, disabled }: { id: string; title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <div className={sections.row}>
      <div className={sections.rowText}>
        <span id={id} className={sections.rowTitle}>{title}</span>
        <span className={sections.rowDescription}>{description}</span>
      </div>
      <span style={{ display: "inline-grid", placeItems: "center", minWidth: 44, minHeight: 44 }}>
        <Switch aria-labelledby={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
      </span>
    </div>
  );
}

function TurboSettingsLite({ data }: { data: TurboAdminData }) {
  const [settings, setSettings] = useState(data.settings);
  const [isPending, startTransition] = useTransition();
  const { status, run } = useActionStatus();
  const save = (next: typeof settings) => {
    setSettings(next);
    startTransition(async () => {
      const done = await run("settings", async () => {
        const result = await updateTurboSettingsAction(next);
        if (!result.success) return { ok: false as const, error: result.error };
        setSettings(next);
        return result;
      }, { done: "Configuração salva", fallback: "Não deu para salvar a configuração agora.", keeps: "As opções anteriores continuam valendo." });
      if (!done) setSettings(data.settings);
    });
  };
  const disabled = !data.canEdit || isPending;
  return (
    <div className={sections.group}>
      {isPending ? <p className={sections.note} role="status">Salvando…</p> : status.settings ? <div className={sections.formBody}><ActionNote status={status.settings} /></div> : null}
      <SettingRow id="turbo-enabled" title="Primeira mensagem inteligente" description="Escolhe a mensagem pelo tipo de anúncio e testa variantes. Desligado, volta ao template configurado em Atendimento." checked={settings.enabled} disabled={disabled} onChange={(value) => save({ ...settings, enabled: value })} />
      <SettingRow id="turbo-cadence" title="Lembretes automáticos" description="Para quem não respondeu: 20 min, 3h, no dia seguinte e despedida em 3 dias, só entre 8h e 20h." checked={settings.cadence} disabled={disabled || !settings.enabled} onChange={(value) => save({ ...settings, cadence: value })} />
      <SettingRow id="turbo-learn" title="Aprender sozinho" description="Depois de 50 envios por variante, usa mais a mensagem que tem mais respostas e segue testando 10%." checked={settings.learn} disabled={disabled || !settings.enabled} onChange={(value) => save({ ...settings, learn: value })} />
      <SettingRow id="turbo-silence-followup" title="Follow-up de quem parou de responder" description={SILENCE_FOLLOW_UP_DESCRIPTION} checked={settings.silenceFollowUp} disabled={disabled} onChange={(value) => save({ ...settings, silenceFollowUp: value })} />
      <div className={sections.formBody}>
        <div className={form.field}>
          <span id="turbo-silence-channel" className={form.label}>Canal do follow-up</span>
          <AppSelect
            aria-label="Canal do follow-up"
            value={settings.silenceFollowUpChannel}
            options={SILENCE_FOLLOW_UP_CHANNEL_OPTIONS}
            disabled={disabled || !settings.silenceFollowUp}
            onValueChange={(value) => save({ ...settings, silenceFollowUpChannel: value as typeof settings.silenceFollowUpChannel })}
          />
          <span className={form.hint}>No mesmo canal da conversa, se ele falhar tenta o outro. Meta só dentro de 24h da última mensagem do cliente; WAHA só se o lead tem número WAHA.</span>
        </div>
        <label className={form.field}>
          <span className={form.label}>Nome da empresa nas mensagens</span>
          <input
            className={form.input}
            defaultValue={settings.companyDisplayName}
            maxLength={60}
            disabled={disabled}
            placeholder="Ex.: Âncora Saúde"
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value !== settings.companyDisplayName) save({ ...settings, companyDisplayName: value });
            }}
          />
          <span className={form.hint}>Vazio usa o nome cadastrado em Configurações, na seção Empresa.</span>
        </label>
        {!data.canEdit ? <p className={sections.note}>Só o diretor altera estas opções.</p> : null}
      </div>
    </div>
  );
}

export function TurboAdminLite({ data }: { data: TurboAdminData }) {
  const [isPending, startTransition] = useTransition();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const missing = data.templates.filter((row) => row.status === "MISSING" || row.status === "REJECTED");
  const approved = data.templates.filter((row) => row.status === "APPROVED").length;

  const { status, fail, clear } = useActionStatus();
  const fire = useFeedback();
  const submit = () => {
    clear("submit");
    fire("tap");
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof submitRecommendedTemplatesAction>>;
      try {
        result = await submitRecommendedTemplatesAction();
      } catch (error) {
        fail("submit", error, { fallback: "Não deu para enviar os templates agora.", keeps: "Os templates continuam como estavam.", retry: submit });
        return;
      }
      if (!result.success) {
        fail("submit", result.error, { fallback: "Não deu para enviar os templates agora.", keeps: "Os templates continuam como estavam.", retry: submit });
        return;
      }
      // A aprovação da Meta é externa e demora: o resultado dela segue no toast.
      if (result.submitted.length) {
        fire("confirm");
        toast.success(`${result.submitted.length} templates enviados para aprovação da Meta.`);
      }
      if (result.failed.length) {
        if (!result.submitted.length) fire("error");
        toast.error(`${result.failed.length} não foram aceitos pela Meta. ${result.failed.map((item) => `${item.name}: ${item.error}`).join(" · ")}`);
      }
      if (!result.submitted.length && !result.failed.length) toast.info("Todos os templates já estão na Meta.");
    });
  };

  const columns: LiteColumn<TemplateRow>[] = [
    { id: "label", label: "Mensagem", primary: true, render: (row) => (
      <span>
        <span className={page.cellTitle}>{row.label}</span>
        <span className={page.cellSub}>{row.body}</span>
        {row.buttons.length ? <span className={page.cellSub}>Botões: {row.buttons.join(" · ")}</span> : null}
      </span>
    ) },
    { id: "touch", label: "Quando", secondary: true, render: (row) => TOUCH_LABEL[row.touch] ?? row.touch },
    { id: "category", label: "Categoria", render: (row) => {
      const recategorized = row.category && row.category.toUpperCase() !== row.expectedCategory;
      return <span>{categoryLabel(row.category ?? row.expectedCategory)}{recategorized ? <span className={page.cellSub} style={{ color: "var(--danger)" }}>A Meta mudou a categoria</span> : null}</span>;
    } },
    { id: "status", label: "Na Meta", render: (row) => {
      const status = STATUS[row.status] ?? { label: row.status };
      return (
        <span>
          <span className={page.badge} data-tone={status.tone}>{status.label}</span>
          {row.rejectedReason ? <span className={page.cellSub}>{row.rejectedReason}</span> : null}
          {row.quality && ["YELLOW", "RED"].includes(row.quality.toUpperCase()) ? <span className={page.cellSub} style={{ color: "var(--danger)" }}>Qualidade {row.quality.toLowerCase()}</span> : null}
        </span>
      );
    } },
  ];

  return (
    <>
      <section className={page.group} aria-labelledby="turbo-templates-title">
        <header className={page.cardHead}>
          <h2 id="turbo-templates-title" className={page.cardTitle}>Templates da qualificação ({approved} de {data.templates.length} aprovados)</h2>
          <p className={page.cardDescription}>Primeira mensagem e lembrete são utilidade (R$ 0,035); reengajamento é marketing (R$ 0,32). Cada botão já responde uma pergunta ou encerra a sequência. Templates ainda não aprovados são pulados sem afetar o atendimento.</p>
        </header>
        <div className={page.toolbar}>
          <button type="button" className={page.button} onClick={() => setSettingsOpen(true)}>
            <Settings aria-hidden="true" size={16} />
            Configurações
          </button>
          {data.canEdit ? (
            <button type="button" className={`${page.primaryButton} ${page.toolbarEnd}`} onClick={submit} disabled={isPending || !missing.length || !data.metaConnected} aria-busy={isPending || undefined}>
              <BusyLabel busy={isPending} label="Enviando…">
                <Send aria-hidden="true" size={16} />
                {missing.length ? `Enviar ${missing.length} à Meta` : "Todos enviados"}
              </BusyLabel>
            </button>
          ) : null}
        </div>
        {status.submit?.state === "error" ? <ActionNote status={status.submit} /> : null}
        {!data.metaConnected ? (
          <div className={sections.notice} data-tone="warning" role="status">
            <p className={sections.note}>Conecte o número oficial da Meta em Integrações, WhatsApp, para enviar os templates.</p>
          </div>
        ) : null}
        <LiteResponsiveData caption="Templates da qualificação" columns={columns} rows={data.templates} rowKey={(row) => row.name} empty={<p className={page.emptyText}>Nenhum template recomendado.</p>} />
      </section>
      <p className={page.cardDescription}>
        Os resultados (quem respondeu, qual mensagem funciona melhor, custo) ficam no <Link href="/dashboard?tab=funnel" className={sections.link}>Funil de qualificação do painel</Link>.
      </p>
      <LiteSidePanel open={settingsOpen} onOpenChange={setSettingsOpen} title="Qualificação turbo" description="Primeira mensagem por tipo de anúncio, testes A/B e lembretes automáticos.">
        <TurboSettingsLite data={data} />
      </LiteSidePanel>
    </>
  );
}
