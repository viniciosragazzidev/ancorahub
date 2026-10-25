"use client";

/**
 * Envio das etapas dos leads para a Meta (Conversions API for CRM) no visual Lite: os mesmos campos, a mesma regra de
 * "salvar só com mudança" e a mesma Server Action do MetaConversionsCard.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Input } from "@/components/arc/input/input";
import { Switch } from "@/components/arc/switch/switch";
import { LiteSelect } from "@/components/lite/controls";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { saveMetaConversionSettingsAction } from "../../meta-conversion-actions";
import type { MetaConversionsPanel } from "../../meta-conversion-service";
import styles from "./meta-lite.module.css";
import integration from "./meta-integration-lite.module.css";

const count = new Intl.NumberFormat("pt-BR");

export function MetaConversionsLite({ panel, datasets }: { panel: MetaConversionsPanel; datasets: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(panel.enabled);
  const [datasetId, setDatasetId] = useState(panel.datasetId ?? (datasets.length === 1 ? datasets[0]!.id : ""));
  const [testEventCode, setTestEventCode] = useState(panel.testEventCode ?? "");
  const [saving, startSaving] = useTransition();
  const dirty = enabled !== panel.enabled || datasetId !== (panel.datasetId ?? "") || testEventCode.trim() !== (panel.testEventCode ?? "");

  const save = () => {
    startSaving(async () => {
      const result = await saveMetaConversionSettingsAction({ enabled, datasetId: datasetId || null, testEventCode: testEventCode.trim() || null });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(enabled ? "Envio de etapas ligado." : "Configuração salva.", {
        description: result.backfilled ? `${result.backfilled} etapa(s) dos últimos 7 dias entraram na fila de envio.` : undefined,
      });
      router.refresh();
    });
  };

  return (
    <section className={page.card} aria-labelledby="meta-conversions-title">
      <div className={styles.cardHeadRow}>
        <div className={page.cardHead}>
          <h2 id="meta-conversions-title" className={page.cardTitle}>Enviar etapas dos leads para a Meta</h2>
          <p className={page.cardDescription}>Os leads de formulário (Lead Ads) avisam a Meta quando chegam, ficam qualificados, quentes e quando viram venda. A Meta usa isso para buscar mais leads parecidos com os que fecham.</p>
        </div>
        <span className={page.badge} data-tone={panel.enabled ? "success" : undefined}>{panel.enabled ? "Ligado" : "Desligado"}</span>
      </div>

      {!panel.available ? (
        <div role="alert" className={integration.warning}>
          <p className={integration.noticeTitle}>Recurso ainda não liberado</p>
          <p className={page.cardDescription}>O banco de dados ainda não recebeu a atualização deste recurso. Fale com o suporte técnico.</p>
        </div>
      ) : (
        <>
          <div className={integration.syncRow}>
            <div className={page.cardHead}>
              <span className={page.cellTitle}>Enviar etapas</span>
              <span className={page.cellSub}>Ao ligar, os leads de formulário dos últimos 7 dias também são enviados. Leads do WhatsApp ficam para uma próxima etapa.</span>
            </div>
            <Switch checked={enabled} disabled={saving} onCheckedChange={(checked) => setEnabled(checked === true)} aria-label={enabled ? "Desligar envio de etapas" : "Ligar envio de etapas"} />
          </div>

          <div className={integration.fields}>
            <div className={integration.field}>
              {datasets.length ? (
                <LiteSelect
                  label="Fonte de dados (dataset)"
                  value={datasetId}
                  placeholder="Escolha a fonte de dados"
                  options={datasets.map((dataset) => ({ value: dataset.id, label: `${dataset.name} · ${dataset.id}` }))}
                  onChange={(value) => { if (!saving) setDatasetId(value); }}
                />
              ) : (
                <>
                  <span className={integration.fieldLabel}>Fonte de dados (dataset)</span>
                  <p className={page.cardDescription}>Nenhuma fonte sincronizada. Use Sincronizar ou Revisar ativos acima.</p>
                </>
              )}
            </div>
            <div className={integration.field}>
              <Input
                id="meta-conversions-test-code"
                label="Código de teste (opcional)"
                value={testEventCode}
                disabled={saving}
                maxLength={64}
                placeholder="TEST12345"
                description="Com código, os eventos aparecem só em Testar eventos e não otimizam campanhas. Apague depois do teste."
                onChange={(event) => setTestEventCode(event.target.value)}
              />
            </div>
          </div>

          <div className={integration.counts}>
            <div className={page.stat}><span className={page.statLabel}>Pendentes</span><span className={page.statValue}>{count.format(panel.counts.pending)}</span></div>
            <div className={page.stat}><span className={page.statLabel}>Enviados</span><span className={page.statValue}>{count.format(panel.counts.sent)}</span></div>
            <div className={page.stat}><span className={page.statLabel}>Recusados</span><span className={page.statValue}>{count.format(panel.counts.failed)}</span></div>
          </div>

          {panel.lastError ? (
            <div className={integration.warning}>
              <p className={integration.noticeTitle}>Último erro</p>
              <p className={page.cardDescription} style={{ overflowWrap: "anywhere" }}>{panel.lastError.message}</p>
              <p className={page.cellSub}>{formatLiteDate(panel.lastError.at, { dateStyle: "short", timeStyle: "short" })}</p>
            </div>
          ) : null}

          <div className={integration.actions}>
            <button type="button" className={page.primaryButton} disabled={saving || !dirty || (enabled && !datasetId)} onClick={save}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
