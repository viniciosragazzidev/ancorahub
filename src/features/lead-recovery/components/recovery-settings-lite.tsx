"use client";

/**
 * Configuração da recuperação de leads (plano §8.4), no painel lateral da Qualificação turbo, visual Lite.
 * Tudo nasce desligado. Cada troca salva na hora (nível 1 do FEEDBACK.md): confirma depois do servidor; a falha
 * desfaz a troca e mostra a causa com "Tentar de novo". Passo de template é sempre Meta (sem escolha de canal).
 */
import { useState, useTransition } from "react";

import { Switch } from "@/components/arc/switch/switch";
import form from "@/components/lite/page/lite-form.module.css";
import page from "@/components/lite/page/lite-page.module.css";
import sections from "@/components/lite/page/lite-sections.module.css";
import { AppSelect } from "@/components/ui/select";
import { ActionNote, useActionStatus } from "@/features/qualification-turbo/components/action-status-lite";
import { useDevLab } from "@/lib/dev-lab";

import { saveRecoverySettingsAction } from "../actions";
import { RECOVERY_STEPS } from "../cadence-rules";
import { recoveryBlockers, type RecoveryChannelSetting, type RecoverySettings, type RecoveryStepId } from "../settings-core";
import { META_COST_BRL } from "../touch-cost";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STEP_TEXT: Record<RecoveryStepId, string> = {
  s2: "S2 · +3 h · pergunta simples (texto livre)",
  s3: "S3 · +20 h · oferece a simulação (texto livre)",
  s4: "S4 · D+2 · lembrete da cotação (template)",
  s5: "S5 · D+4 · oferta de ligação (template)",
  s6: "S6 · D+7 · despedida (template)",
  w2: "Morno · +2 h · avisa que o corretor vai chamar",
  w3: "Morno · +20 h · ligação ou WhatsApp",
  n1: "Nutrição · 1º mês",
  n2: "Nutrição · 2º mês",
  n3: "Nutrição · 3º mês",
};
const CHANNEL_OPTIONS = [
  { value: "same", label: "Mesmo canal da conversa" },
  { value: "meta", label: "Só Meta (oficial)" },
  { value: "waha", label: "Só WAHA" },
];
const HOURS = Array.from({ length: 16 }, (_, index) => index + 7).map((hour) => ({ value: String(hour), label: `${hour}h` }));
const CONTROL = [0, 5, 10, 20].map((value) => ({ value: String(value), label: value ? `${value}% dos leads` : "Sem controle" }));
const LIVE_STEPS = new Set<RecoveryStepId>(RECOVERY_STEPS.map((step) => step.id));

function Row({ id, title, description, checked, onChange, disabled }: { id: string; title: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
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

export function RecoverySettingsLite({ initial, canEdit }: { initial: RecoverySettings; canEdit: boolean }) {
  const lab = useDevLab();
  const [settings, setSettings] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const { status, run } = useActionStatus();
  const persist = lab?.recoverySettings ?? saveRecoverySettingsAction;
  const save = (next: RecoverySettings) => {
    const previous = settings;
    setSettings(next);
    startTransition(async () => {
      const done = await run("recovery", async () => {
        const result = await persist(next);
        if (!result.ok) return { ok: false as const, error: result.error };
        setSettings(result.settings);
        return { ok: true as const };
      }, { done: "Recuperação salva", fallback: "Não deu para salvar a recuperação agora.", keeps: "As opções anteriores continuam valendo." });
      if (!done) setSettings(previous);
    });
  };
  const disabled = !canEdit || isPending;
  const blockers = recoveryBlockers(settings);
  const setStep = (id: RecoveryStepId, patch: Partial<{ enabled: boolean; channel: RecoveryChannelSetting }>) => save({ ...settings, steps: { ...settings.steps, [id]: { ...settings.steps[id], ...patch } } });

  return (
    <div className={sections.group}>
      {isPending ? <p className={sections.note} role="status">Salvando…</p> : status.recovery ? <div className={sections.formBody}><ActionNote status={status.recovery} /></div> : null}
      <div className={sections.notice} data-tone={blockers.length ? "warning" : undefined} role="status">
        <p className={sections.note}>
          {blockers.length ? `A cadência nova não envia nada. ${blockers.join(" ")}` : `Ligada. ${settings.controlPct}% dos leads ficam no grupo de controle e recebem só o que já existe hoje.`}
        </p>
      </div>
      <Row id="recovery-enabled" title="Recuperação de leads" description="Interruptor geral da cadência nova. Desligado, nada muda: seguem só os lembretes do turbo e o follow-up de silêncio." checked={settings.enabled} disabled={disabled} onChange={(value) => save({ ...settings, enabled: value })} />
      <Row
        id="recovery-legal"
        title="Conferência jurídica feita"
        description={settings.legalReviewedAt ? `Registrada em ${new Date(settings.legalReviewedAt).toLocaleDateString("pt-BR")}. LGPD (legítimo interesse, saída em toda mensagem) e telemarketing de SP e RJ.` : "Obrigatória antes de qualquer envio novo: LGPD (legítimo interesse, saída em toda mensagem) e as leis de telemarketing de SP e RJ."}
        checked={Boolean(settings.legalReviewedAt)}
        disabled={disabled}
        onChange={(value) => save({ ...settings, legalReviewedAt: value ? new Date().toISOString() : null })}
      />
      <p className={page.sectionTitle} style={{ padding: "16px 16px 0" }}>Quem recebe</p>
      <Row id="recovery-stopped" title="Parou no meio" description="Respondeu e parou: S2 (+3 h) e S3 (+20 h) no texto livre, depois S4, S5 e S6 por template. No máximo 6 mensagens sem resposta." checked={settings.stoppedMidway} disabled={disabled} onChange={(value) => save({ ...settings, stoppedMidway: value })} />
      <Row id="recovery-warm" title="Morno sem contato do corretor" description="Se o corretor não fizer o 1º contato em 2 h, a IA avisa o cliente que ele vai chamar." checked={settings.warmBridge} disabled={disabled} onChange={(value) => save({ ...settings, warmBridge: value })} />
      <Row id="recovery-call-queue" title="Fila de ligação (Sem resposta)" description="Quem termina a cadência sem responder vai para a fila da unidade, trabalhada pelo Call Âncora, no lugar do segurado sem dono." checked={settings.callQueue} disabled={disabled} onChange={(value) => save({ ...settings, callQueue: value })} />
      <Row id="recovery-scoring" title="Pontuação perfil × interesse" description="Ordena a fila de ligação e o Call Âncora pela chance de venda (A1 a D4). Nunca usa dado de saúde." checked={settings.scoring} disabled={disabled} onChange={(value) => save({ ...settings, scoring: value })} />
      <Row id="recovery-nurture" title="Nutrição mensal" description={`Quem não atendeu a fila ou disse 'agora não': até 3 toques, um por mês, com motivo concreto (reajuste, faixa de idade). Template de Marketing, cerca de ${brl(META_COST_BRL.marketing)} cada.`} checked={settings.nurture} disabled={disabled} onChange={(value) => save({ ...settings, nurture: value })} />
      <Row id="recovery-ab" title="Teste A/B por passo" description="Testa variantes de cada passo e passa a usar mais a que recupera mais, depois de amostra suficiente." checked={settings.stepExperiments} disabled={disabled} onChange={(value) => save({ ...settings, stepExperiments: value })} />
      <div className={sections.formBody}>
        <div className={form.field}>
          <span className={form.label}>Grupo de controle</span>
          <AppSelect aria-label="Grupo de controle" value={String(settings.controlPct)} options={CONTROL} disabled={disabled} onValueChange={(value) => save({ ...settings, controlPct: Number(value) })} />
          <span className={form.hint}>Sorteado por lead e fixo. É a prova de que a cadência dobrou os recuperados.</span>
        </div>
        <div className={form.field}>
          <span className={form.label}>Envia a partir de</span>
          <AppSelect aria-label="Envia a partir de" value={String(settings.sendStartHour)} options={HOURS} disabled={disabled} onValueChange={(value) => save({ ...settings, sendStartHour: Number(value) })} />
        </div>
        <div className={form.field}>
          <span className={form.label}>Envia até</span>
          <AppSelect aria-label="Envia até" value={String(settings.sendEndHour)} options={HOURS} disabled={disabled} onValueChange={(value) => save({ ...settings, sendEndHour: Number(value) })} />
          <span className={form.hint}>Segunda a sábado. Domingo só para quem escreveu no próprio domingo.</span>
        </div>
      </div>
      <p className={page.sectionTitle} style={{ padding: "16px 16px 0" }}>Passos e canal</p>
      {(Object.keys(STEP_TEXT) as RecoveryStepId[]).filter((id) => LIVE_STEPS.has(id) || settings.nurture).map((id) => {
        const template = id === "s4" || id === "s5" || id === "s6" || id.startsWith("n");
        return (
          <div key={id} className={sections.formBody}>
            <Row id={`recovery-step-${id}`} title={STEP_TEXT[id]} description={template ? `Template de Marketing aprovado pela Meta (exceção da DEC-155 só para a recuperação). Sai só pela Meta oficial, cerca de ${brl(META_COST_BRL.marketing)} por mensagem entregue.` : "Texto livre, com prévia na Qualificação. Vai com a saída: “Se não quiser mais receber, responda SAIR.”"} checked={settings.steps[id].enabled} disabled={disabled} onChange={(value) => setStep(id, { enabled: value })} />
            {!template ? (
              <div className={form.field}>
                <span className={form.label}>Canal</span>
                <AppSelect aria-label={`Canal do passo ${id.toUpperCase()}`} value={settings.steps[id].channel} options={CHANNEL_OPTIONS} disabled={disabled || !settings.steps[id].enabled} onValueChange={(value) => setStep(id, { channel: value as RecoveryChannelSetting })} />
                <span className={form.hint}>Meta só dentro de 24 h da última mensagem do cliente; WAHA só se a conversa já está no WAHA. No mesmo canal, se ele não vale, tenta o outro.</span>
              </div>
            ) : null}
          </div>
        );
      })}
      {!canEdit ? <p className={sections.note} style={{ padding: 16 }}>Só o diretor altera a recuperação.</p> : null}
    </div>
  );
}
